
🕵️‍♂️ ИНСТРУКЦИЯ ПО РАСШИРЕННОМУ ИБ-ОТЛАДОЧНОМУ СКАНИРОВАНИЮ БЭКЕНДА (DEBUG / LOGGING)

Настоящее техническое руководство содержит пошаговый регламент конфигурации сквозного 
логирования, перехвата скрытых крахов Python-рантайма, трассировки асинхронных сокетов Uvicorn 
и разбора инцидентов безопасности. 

------------------------------------------------------------------------------------------
КОНТУР СКВОЗНОЙ ОТЛАДКИ И ТРАССИРОВКИ АСИНХРОННЫХ ПОТОКОВ (LOGGING MAP)
------------------------------------------------------------------------------------------
Мониторинг аномалий бэкенда FastAPI опирается на трехуровневую фильтрацию событий: 
Uvicorn-сервер, внутреннее ядро логирования приложения и системный демон `journald` ОС Linux.

--- Схема прохождения пакетов отладки и фильтрации трассировок ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СЕТЕВОЙ КРАХ ИЛИ АНОМАЛИЯ В main.py / utils.py</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Перехватчик: logging.getLogger("fastapi") ──► Инициализация логгера</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: ПРИНУДИТЕЛЬНОЕ ПЕРЕКЛЮЧЕНИЕ УРОВНЯ ОЗУ-ФИЛЬТРАЦИИ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">logger.setLevel(logging.DEBUG) ──► Форматирование: %(asctime)s [%(levelname)s] %(message)s</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Трансляция потоков вывода sys.stdout / sys.stderr</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Контур А: Аварийный крах (exc_info=True)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#fffbeb; border:1px solid #f59e0b; border-radius:4px; color:#92400e; font-weight:bold;">
            Контур Б: Сетевой Debug-дребезг (Trace)
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🚨 Выброс полного Stack Trace (блока трассировки Python).<br>
            💾 Выявление точной строки падения со всеми переменными ОЗУ.<br>
            🛡️ Маскирование на фронтенд: HTTP 500 без утечки структуры.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🕵️‍♂️ Логирование сырых JSON-пакетов запросов fetch.<br>
            📡 Фиксация состояния пула соединений psycopg.<br>
            ⏱️ Контроль времени исполнения DDL на удаленных СУБД.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      КОНСОЛИДАЦИЯ СЛУЖБОЙ SYSTEMD ──► ВЫЧИТКА КОМАНДОЙ JOURNALCTL -U PGRIGHTS
    </td>
  </tr>
</table>

### 🛠️ Пошаговый алгоритм проведения глубокой отладки (Debugging):

1. **Перевод бэкенда в расширенный режим DEBUG:**
   Откройте файл `main.py`, найдите секцию инициализации логгера и принудительно переведите его в режим максимальной детализации. Измените уровень логирования:
   `logger.setLevel(logging.DEBUG)`
   При запуске Uvicorn-сервера через терминал или systemd-юнит обязательно пропишите флаг отладки:
   `uvicorn main:app --host 127.0.0.1 --port 8000 --log-level debug`

2. **Запуск живого мониторинга системного потока:**
   Откройте SSH-терминал сервера панели и запустите непрерывное чтение логов службы, отсекая старый мусор:
   `journalctl -u pgrights.service -f -n 50`
   Сделайте тестовое действие в веб-интерфейсе панели. На экране терминала мгновенно отобразится прохождение HTTP-пакета, включая ID сессии, роль оператора и сгенерированный SQL-запрос.

3. **Локализация скрытых синтаксических ошибок (Traceback):**
   При возникновении непредвиденных крахов (ошибка 500 в браузере), бэкенд благодаря конструкции `logger.error(..., exc_info=True)` выведет в журнал полный многострочный Traceback. Найдите верхнюю строчку блока — там будет указан точный файл (например, `main.py`), номер строки кода и тип системного исключения Python (например, `KeyError`, `TypeError`, `ValueError`).

------------------------------------------------------------------------------------------
ИСПРАВЛЕННАЯ СЛУЖЕБНАЯ ИНСТРУКЦИЯ ПО ОПЕРАТИВНОМУ ДЕБАЖУ
------------------------------------------------------------------------------------------
Контур обеспечивает экспресс-диагностику низкоуровневых сбоев рантайма, пулов сокетов 
и криптографических ошибок при развертывании приложения.

--- Матрица диагностических кодов и ИБ-затворов бэкенда ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СИСТЕМНЫЙ МАРКЕР ОШИБКИ И СТАТУС В ЖУРНАЛЕ COHТРОЛЯ</td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem; line-height:1.4;">
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px; width:45%; background-color:#ffeeeb; color:#991b1b; font-weight:bold; border-right:1px solid #e2e8f0;">
            ⚠️ OperationalError: connection to server at "127.0.0.1", port 5432 failed: Connection refused
          </td>
          <td style="padding:10px; color:#334155;">
            <strong>Причина:</strong> Физическое падение службы PostgreSQL-18 или блокировка порта локальным Firewalld.<br>
            🛠️ <strong>Фикс:</strong> Выполнить <code>systemctl restart postgresql-18</code> и проверить порты утилитойss.
          </td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px; background-color:#ffeeeb; color:#991b1b; font-weight:bold; border-right:1px solid #e2e8f0;">
            ⚠️ InvalidToken / Cryptography.fernet.InvalidToken
          </td>
          <td style="padding:10px; color:#334155;">
            <strong>Причина:</strong> Скомпрометирован или изменен MASTER_KEY в файле настроек .env.<br>
            🛠️ <strong>Фикс:</strong> Вернуть старый ключ расшифровки или принудительно перерегистрировать пароли всех серверов.
          </td>
        </tr>
        <tr>
          <td style="padding:10px; background-color:#ffeeeb; color:#991b1b; font-weight:bold; border-right:1px solid #e2e8f0;">
            ⚠️ TypeError: SQL identifier parts must be strings, got (tuple) instead
          </td>
          <td style="padding:10px; color:#334155;">
            <strong>Причина:</strong> В класс sql.Identifier передан сырой кортеж fetchone() вместо чистой строки.<br>
            🛠️ <strong>Фикс:</strong> Распаковать кортеж в коде Python по первому индексу: <code>row[0]</code>.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      КОНТУР ОПЕРАТИВНОГО ТЕСТИРОВАНИЯ И ДЕБАЖА УСПЕШНО ЗАКРЫТ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-безопасности при проведении отладочных работ:
* **Защита от утечки системных отладочных данных (Debug Data Leakage)**: При переводе логгера 
  в режим `DEBUG`, детальные трассировки пишутся исключительно во внутренние журналы 
  сервера (systemd journald). На внешний интерфейс клиента в браузер (Network) 
  при любых крахах по-прежнему отдается только изолированный, абстрактный заголовок 
  `detail: "Ошибка выполнения запроса на удаленном сервере СУБД."`. Это полностью исключает 
  риск проведения разведки структуры кода злоумышленником через интерфейс.
* **Санитизация и очистка журналов**: Логирование паролей в открытом виде внутри `journald` 
  намертво заблокировано маскированием переменных на уровне функций `utils.py` и `main.py`.

