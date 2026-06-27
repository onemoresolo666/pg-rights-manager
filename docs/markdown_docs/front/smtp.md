
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И ИБ-АНАЛИЗ МОДУЛЯ НАСТРОЙКИ ПОЧТЫ (smtp.js)

Настоящий архитектурный документ содержит детальное описание, профили безопасности 
и пошаговый структурный разбор системных перехватчиков конфигурации почтового шлюза 
и отправки тестовых уведомлений на стороне клиента (smtp.js).

------------------------------------------------------------------------------------------
КОНТУР ЗАПЕЧАТЫВАНИЯ КОНФИГУРАЦИИ ШЛЮЗА (submitSmtpConfigForm)
------------------------------------------------------------------------------------------
Модуль обеспечивает сбор параметров авторизации почтового шлюза, строгое рантайм-выравнивание 
типов и их трансляцию на бэкенд для последующей фиксации в файле .env.

--- Схема рантайм-валидации и запечатывания параметров SMTP ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ОТПРАВКА ФОРМЫ НАСТРОЕК (submitSmtpConfigForm)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Считывание текстовых строк инпутов: smtp_host, smtp_user, smtp_password</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: ПРИНУДИТЕЛЬНОЕ ВЫРАВНИВАНИЕ ТИПОВ ДАННЫХ В ОЗУ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">smtp_port = parseInt(..., 10) ──► use_tls = (value === 'true')</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Асинхронная POST-транзакция: secureFetch('/api/smtp/config')</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Ответ сервера: response.ok == true
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Ответ сервера: response.ok == false / Сбой
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Вызов showAlert(..., 'success').<br>
            💬 Сообщение: 'Конфигурация SMTP запечатана в .env и применена!'.<br>
            💾 Шлюз полностью готов к рассылке UUID-паролей.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Перехват синтаксических ошибок валидации Pydantic.<br>
            🚨 Маскирование сырых трассировок: showAlert(data.detail || 'Ошибка').<br>
            🚷 Резервный catch(err): Локализация сетевых обрывов.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      КОНТУР КОНФИГУРАЦИИ БЕЗОПАСНО ЗАВЕРШИЛ СЕССИЮ ПЕРЕДАЧИ ДАННЫХ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы запечатывания настроек:
* **Защита от внедрения типов данных на стороне API (Type Injection Protection)**: Сетевой порт 
  принудительно прогоняется через инструкцию десятичного парсинга `parseInt(..., 10)`. Если 
  злоумышленник попытается подменить числовое поле порта на деструктивную текстовую инъекцию 
  через консоль, фронтенд сбросит значение в `NaN`, что вызовет корректный барьер 
  валидации на стороне Python-модели без угрозы для стабильности рантайма.
* **Строгая булевая нормализация флагов криптографии**: Выбор протокола доставки `use_tls` 
  явно переводится в логический тип `true/false` через строгое строковое сравнение `=== 'true'`. 
  Это исключает отправку зашумленных текстовых значений и гарантирует корректную активацию 
  SSL-сокетов на бэкенде.

------------------------------------------------------------------------------------------
МОДУЛЬ АВТОМАТИЗАЦИИ И ОПОВЕЩЕНИЙ (smtp.js)
------------------------------------------------------------------------------------------
Контур обеспечивает отправку тестового пакета оповещения на корпоративный почтовый 
реле-сервер и реализует анимационный ИБ-затвор контроля состояния кнопок ввода.

--- Схема работы анимационного UX-затвора защиты от спама кликов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ЗАПУСК ПРОВЕРКИ ШЛЮЗА: submitSmtpTestForm(event)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Считывание адресата: const recipient = smtpTestRecipient.value.trim()</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">АКТИВАЦИЯ ПРЕДОХРАНИТЕЛЬНОГО UX-ЗАТВОРА КНОПКИ СВЯЗИ</div>
      <div style="font-size:0.85rem; color:#e2e8f0;">btnSubmit.disabled = true; ──► Изменение текста: 'Отправка...'</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Асинхронный fetch: secureFetch('/api/smtp/test-send', { method: 'POST' })</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Шлюз вернул статус: response.ok == true
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Шлюз вернул статус: response.ok == false / Сбой
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Вызов: showAlert(..., 'success').<br>
            💬 Сообщение: 'Тестовый алерт успешно доставлен адресату!'.<br>
            📬 Контур связи с реле-сервером проверен и готов.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Перехват отказов SMTP-реле-серверов.<br>
            🚨 Вывод сообщения: 'Почтовый шлюз отклонил авторизацию'.<br>
            💥 Секция catch(err): Перехват сетевых крахов.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ВЫЗОВ FINALLY: БЕЗОПАСНЫЙ СНОС БЛОКИРОВОК КНОПКИ СВЯЗИ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы тестирования алерта:
* **Защита от атак отказа в обслуживании методом спама кликов (Click-Flood Protection)**: Процесс 
  установления сессии и авторизации на корпоративном SMTP-сервере может занимать длительное время. 
  Инструкции `btnSubmit.disabled = true` и `innerText = 'Отправка...'` полностью исключают риск 
  генерации пачки параллельных сетевых пакетов при нетерпеливых кликах оператора, защищая 
  бэкенд от перегрузки асинхронных сокетов.
* **Гарантированное высвобождение интерфейса при любых авариях**: Обязательный вызов секции 
  `finally` на строках 59–64 гарантирует, что даже при полном падении сети, крахе Uvicorn или 
  таймауте, кнопка вернётся в исходное боевое состояние с текстом `"Отправить тест"`. Это 
  полностью исключает зависание элементов управления и парализацию экрана.

------------------------------------------------------------------------------------------
МОДУЛЬ АВТОМАТИЗАЦИИ И ОПОВЕЩЕНИЙ (smtp.js)
------------------------------------------------------------------------------------------

--- Описание механизмов отказоустойчивости и защиты контура ---

* Изоляция сырых трассировок при крахе сетевой сессии
  Асинхронные обработчики отправки форм полностью изолированы внутренними блоками 
  try-catch. При физическом падении интернет-канала, 
  блокировках корпоративного прокси-сервера или таймаутах, низкоуровневый стек ошибок 
  JavaScript не выводится наружу в веб-интерфейс, исключая проведение разведки 
  архитектуры клиентом. Оператору выдается очищенное абстрактное сообщение 
  через защищенный метод санитизации showAlert.

