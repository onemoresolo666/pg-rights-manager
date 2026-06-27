
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И СХЕМАТИЧЕСКИЙ РАЗБОР МОДУЛЯ АВТОМАТИЗАЦИИ И ОПОВЕЩЕНИЙ (smtp.py)

Настоящий технический документ содержит исчерпывающее описание, паспорт безопасности и 
детальный пошаговый разбор всех трех частей модуля конфигурации почтового шлюза оповещений. 

------------------------------------------------------------------------------------------
МОДУЛЬ АВТОМАТИЗАЦИИ И ОПОВЕЩЕНИЙ (smtp.py)
------------------------------------------------------------------------------------------
Модуль smtp.py осуществляет прямое взаимодействие с внешними почтовыми реле-серверами 
корпоративного контура, а также отвечает за безопасное сохранение конфигураций и 
доставку одноразовых ссылок доступа.

--- Схема асинхронного потока данных почтового шлюза ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">API-ЭНДПОИНТ (POST /api/smtp/config)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">JSON-пакет настроек (SmtpConfigSchema)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">АСИНХРОННЫЙ КОНТУР FASTAPI (run_in_threadpool)</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Изоляция синхронных операций ввода-вывода (I/O) диска от Event Loop</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Изолированный пул потоков</span></td>
  </tr>
  <tr style="background-color:#f8fafc; border:2px solid #e2e8f0;">
    <td style="padding:20px;">
      <div style="font-weight:bold; font-size:1.05rem; color:#0f172a; text-align:center; margin-bottom:15px; border-bottom:2px solid #cbd5e1; padding-bottom:8px;">ТРАНЗАКЦИОННАЯ ЗАПИСЬ (write_config_to_env)</div>
      <ul style="list-style-type:none; padding:0; margin:0; font-size:0.9rem; color:#334155; line-height:1.6;">
        <li style="margin-bottom:10px; padding-left:15px; border-left:3px solid #3b82f6;"><strong>1. МОДИФИКАЦИЯ:</strong> Атомарное обновление конфигурационного файла .env на диске</li>
        <li style="margin-bottom:10px; padding-left:15px; border-left:3px solid #10b981;"><strong>2. ОБНОВЛЕНИЕ ОКРУЖЕНИЯ:</strong> Синхронизация переменных процесса (os.environ)</li>
        <li style="margin-bottom:5px; padding-left:15px; border-left:3px solid #f59e0b;"><strong>3. КЛИНИНГ ОЗУ:</strong> Валидация и обновление типов данных (bool/int) в utils</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Успешная авторизация шлюза</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">ВНЕШНИЙ SMTP-РЕЛЕ СЕРВЕР (Yandex / Mail.ru / Exchange)</td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы перезаписи конфигурации:
* **Защита от инжектов в конфигурационные файлы**: На этапе разбора Pydantic-модели 
  внедрена жесткая очистка входящих строк методом `.strip()`. При парсинге флага 
  TLS значение принудительно переводится в верхний регистр `.upper()` и валидируется по 
  белому списку строк `["TRUE", "1", "YES"]`. Это полностью исключает возможность внедрения 
  вредоносных символов переноса строк (`\n`) или инжектов скрытых переменных в операционную систему.
* **Сохранение целостности структуры метаданных**: Алгоритм построчной перезаписи 
  `write_config_to_env` модифицирует исключительно легитимные ключи SMTP, полностью 
  сохраняя стороннюю разметку, пустые строки и комментарии файловой системы Linux.
* **Предотвращение синтаксического падения зависимых воркеров (Runtime Refresh)**: Обновление 
  оперативной памяти процесса `os.environ` сопровождается принудительным приведением типов 
  в модуле `utils`. Порт СУБД/почты приводится строго к типу `int`, а флаг безопасности — 
  к типу `bool`. Это страхует фоновые асинхронные задачи от сбоев несовместимости типов 
  `TypeError` после динамической перенастройки шлюза без перезапуска всей службы.

--- Подробное описание эндпоинтов почтового контура ---

* Эндпоинт сохранения параметров почтового шлюза (POST /config)
  Запрос принимает валидированный пакет SmtpConfigSchema под жестким контролем 
  зависимости RoleChecker(["admin"]). Для предотвращения блокирующих дедлоков 
  асинхронного ядра Uvicorn тяжелая дисковая операция записи выносится из Event Loop в 
  отдельный изолированный пул потоков с помощью инструмента run_in_threadpool. 
  Любые физические крахи накопителя перехватываются, логируются как [ИБ-КРАХ] с полным 
  traceback и маскируются в безопасный плоский JSON-ответ с кодом 500.

* Эндпоинт отправки тестового алерта безопасности (POST /test-send)
  Маршрут доступен исключительно роли "admin". Извлекает актуальные авторизационные 
  параметры SMTP напрямую из окружения оперативной памяти, исключая легаси-заглушки. 
  Скрипт динамически собирает глянцевую структуру MIMEMultipart с HTML-версткой тела оповещения 
  о готовности Production-периметра панели к эксплуатации. 

--- Схема распределения криптографических протоколов доставки писем (HTML) ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">КОНТРОЛЛЕР СЕТЕВЫХ ПОРТОВ SMTP КЛИЕНТА</td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
        <tr>
          <td style="text-align:center; font-weight:bold; color:#0f172a; padding-bottom:8px;">Условие: Порт == 465 (или use_ssl_direct)</td>
          <td style="text-align:center; font-weight:bold; color:#0f172a; padding-bottom:8px;">Условие: Порт == 587 (или иные порты)</td>
        </tr>
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffffff; border:1px solid #3b82f6; border-radius:4px; color:#1e293b;">
            <strong>Прямой SSL/TLS Канал</strong><br>
            <span style="font-size:0.8rem; color:#64748b;">aiosmtplib.SMTP(use_tls=True)</span>
          </td>
          <td style="width:49%; padding:12px; background-color:#ffffff; border:1px solid #f59e0b; border-radius:4px; color:#1e293b;">
            <strong>Каскадный Апгрейд STARTTLS</strong><br>
            <span style="font-size:0.8rem; color:#64748b;">aiosmtplib.SMTP(start_tls=True)</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; font-size:0.85rem;">
      Жесткий ИБ-затвор: На все асинхронные сокеты наложен лимит сессии timeout=10 секунд
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы распределения протоколов:
* **Защита от MITM-атак (Перехват сессии)**: Жёсткое разделение нативного SSL и STARTTLS 
  полностью решает проблему уязвимости «Downgrade Attack». Рантайн не пытается 
  отправлять аутентификационные данные по открытому тексту, если порт шлюза 
  инициализирован на защищенный корпоративный контур.
* **Лимитирование ресурсов (DoS Protection)**: Параметр `timeout=10` гарантирует 
  автоматический сброс подвисших TCP-соединений. Если удаленный шлюз выполняет 
  скрытую Tarpit-задержку пакетов, панель не тратит ресурсы асинхронного Loop.

--- Схема сквозного ИБ-аудита и каскадной обработки ошибок ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">КОНТРОЛЛЕР ДОСТАВКИ ПАКЕТА (smtp_client.send_message)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Асинхронный запуск сессии авторизации Шлюза</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ПЕРЕХВАТ СЕТЕВЫХ И КРИПТОГРАФИЧЕСКИХ ИСКЛЮЧЕНИЙ РАНТАЙМА</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Контроль выполнения методов: await smtp_client.login() ──► .send_message()</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление логики обработки сбоев связи</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:10px; background-color:#fffbeb; border:1px solid #f59e0b; border-radius:4px; color:#92400e; font-weight:bold;">
            aiosmtplib.SMTPAuthenticationError<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#b45309;">Лог: [ИБ-АУДИТ] !!! ОТКАЗ SMTP | Ошибка авторизации. Ответ: HTTP 401</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:10px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Exception as e (Общие крахи / Таймаут)<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#b91c1c;">Жёсткий лог: [ИБ-КРАХ] Фатальная ошибка подключения. Ответ: HTTP 500</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Маскирование сырых трассировок от внешних API-интерфейсов</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      УСПЕХ: ВЫХОД ИЗ СЕССИИ (await smtp_client.quit()) ──► ОТВЕТ КОД 200 SUCCESS
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы обработки ошибок почты:
* **Защита от утечки паролей приложений и учетных данных**: При сбое проверки подлинности 
  на внешнем сервере реле, специфическое исключение `SMTPAuthenticationError` полностью 
  перехватывается бэкендом панели на строке 222. Журналирование инцидента в системный лог 
  выводится в очищенном текстовом виде без раскрытия скомпрометированных секретов СУБД 
  и паролей. Внешний клиент получает стандартизированный код `HTTP 401`.
* **Предотвращение бесконечного ожидания ответа**: На асинхронный клиент `aiosmtplib.SMTP` 
  наложен принудительный таймаут `timeout=10` секунд. Это гарантирует, что если 
  корпоративный или внешний почтовый сервер заблокирует сессию панели, рабочий поток uvicorn 
  не зависнет в рантайме и вовремя освободит выделенные ресурсы памяти.
* **Маскирование внутренней топологии сети**: Любые иные ошибки сокетов, отказы DNS-серверов 
  или просадки сетевых шлюзов изолируются в общий блок `except Exception`. Подробная 
  трассировка стека пишется исключительно в защищенный локальный журнал РЕД ОС / CentOS с тегом 
  `[ИБ-КРАХ]`, защищая архитектуру корпоративного периметра от внешней разведки.


