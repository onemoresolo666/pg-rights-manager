
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И СХЕМАТИЧЕСКИЙ РАЗБОР ГЛАВНОГО ДЕМОНА СЛУЖБЫ (main.py)

Настоящий документ содержит детальное архитектурное описание, профили безопасности 
и пошаговый структурный разбор всех ключевых эндпоинтов главного запускающего файла 
и координатора API-сервисов панели.

------------------------------------------------------------------------------------------
ГЛАВНЫЙ СЛУЖЕБНЫЙ ДЕМОН И ИНИЦИАТОР СЛУЖБЫ (main.py)
------------------------------------------------------------------------------------------
Контур обеспечивает запуск асинхронного жизненного цикла веб-панели (Lifespan), автоматическую 
проверку и инжект параметров суперпользователя и авторизацию операторов системы.

--- Схема асинхронного инициализатора Lifespan  ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СТАРТ СЛУЖБЫ SYSTEMD (Lifespan-Инициализатор)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сборка пула соединений (utils.init_pool())</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: ПРОВЕРКА ЦЕЛОСТНОСТИ ТАБЛИЦ ПАНЕЛИ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">SELECT 1 FROM public.panel_users WHERE username = 'admin';</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление логики первого запуска системы</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Пользователь 'admin' найден<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#047857;">Пропуск автоматической генерации мастер-аккаунта</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#f0fdf4; border:1px solid #3b82f6; border-radius:4px; color:#1e40af; font-weight:bold;">
            База полностью пуста<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#2563eb;">INSERT 'admin' / Хэш 'admin123' (12 раундов Bcrypt)</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Активация фонового контура очистки токенов</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center;">
    <td style="padding:12px; font-size:0.85rem;">
      asyncio.create_task(users.token_garbage_collector()) ──► Сброс пула по сигналу остановки
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистем жизненного цикла и входа:
* **Защита от уязвимости отсутствия мастер-доступа**: Контекстный менеджер `lifespan` на старте 
  FastAPI гарантирует, что система никогда не запустится в режиме «заблокированного входа». 
  Если СУБД развернута с нуля, ядро автоматически инжектирует учетную запись `admin`. Её пароль 
  записывается 12-раундным криптографическим Bcrypt-хэшем (`gensalt()`), предотвращая утечку 
  исходного текста.
* **Противодействие тайминг-атакам (Time-Based Side-Channel Attacks)**: Внутри эндпоинта `/api/login` 
  проверка пароля методом `checkpw()` защищена от перебора по времени отклика. Если злоумышленник 
  передает несуществующий логин, бэкенд имитирует ложную валидацию хэша, выравнивая время ответа сервера 
  и полностью лишая атакующего возможности удаленной разведки структуры базы данных.
* **Корректное удаление ресурсов операционной системы при шатдауне**: При получении системного 
  сигнала об остановке или перезапуске процесса (`SIGTERM`/`systemctl stop`), секция завершения lifespan 
  вызывает `.cancel()` для фонового демона токенов и каскадно уничтожает сокеты `utils.close_pool()`. 
  Это исключает появление зависших зомби-потоков в ОЗУ РЕД ОС / CentOS.

--- Подробное описание эндпоинтов веерного управления правами ---

* Контур веерного наката и отзыва принудительных прав (POST /api/manage-privileges)
  Маршрут осуществляет сквозное управление уровнями DATABASE, SCHEMA, TABLE, SEQUENCE. 
  Внедрен функционал дефолтных прав: генерация и накат тяжелых команд ALTER DEFAULT PRIVILEGES 
  происходит исключительно при массовом выделении (флаг ALL) или в режиме DEFAULT. 

--- Схема веерного наката привилегий и ИБ-экранирования DDL ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">КОНТРОЛЛЕР ВЕЕРНОГО УПРАВЛЕНИЯ ПРИВИЛЕГИЯМИ СУБД</td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
        <tr>
          <td style="text-align:center; font-weight:bold; color:#0f172a; padding-bottom:8px;">Входной параметр: schema_param == "ALL"</td>
          <td style="text-align:center; font-weight:bold; color:#0f172a; padding-bottom:8px;">Входной параметр: конкретное имя (public)</td>
        </tr>
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffffff; border:1px solid #3b82f6; border-radius:4px; color:#1e293b;">
            <strong>Веерный перебор каталога</strong><br>
            <span style="font-size:0.8rem; color:#64748b;">SELECT schema_name FROM information_schema.schemata</span>
          </td>
          <td style="width:49%; padding:12px; background-color:#ffffff; border:1px solid #10b981; border-radius:4px; color:#1e293b;">
            <strong>Точечная фиксация</strong><br>
            <span style="font-size:0.8rem; color:#64748b;">target_schemas = [s.strip() for s in split(',')]</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; font-size:0.85rem;">
      ИБ-Компиляция DDL: Безопасные токены sql.Identifier(username) и sql.SQL(", ").join() полностью исключают инъекции
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты эндпоинта управления привилегиями:
* **Защита от SQL-инъекций на динамическом DDL**: Поскольку команды управления правами (GRANT/REVOKE) 
  и изменения дефолтных политик (ALTER DEFAULT PRIVILEGES) не поддерживают стандартные плейсхолдеры 
  подготовленных запросов СУБД, в модуле реализована строгая компиляция через `psycopg.sql`. 
  Имена объектов и ролей экранируются токеном `sql.Identifier`, а списки прав разделяются через 
  безопасный джоин `sql.SQL(", ").join()`, на корню отсекая возможность внедрения кавычек и стороннего DDL-кода.
* **Изолированный механизм повторного исполнения транзакций (Retry)**: При выполнении массовых 
  операций СУБД может вернуть ошибку конкурентной блокировки кортежей или взаимного исключения 
  каталогов. Модуль перехватывает ошибки со словами "lock", "deadlock" или "concurrent" и осуществляет 
  повторную попытку наката через фиксированную ИБ-паузу `time.sleep(0.1)`, минимизируя сбои рантайма.
* **Предотвращение размазывания дефолтных прав схемы**: Функционал на строках 803–804 жестко контролирует 
  вызовы `ALTER DEFAULT PRIVILEGES`. Если оператор выдает точечные права на одну конкретную 
  таблицу, глобальные настройки создания будущих объектов схемы не затрагиваются, предотвращая 
  несанкционированное наследование привилегий новыми сущностями.

--- Подробное описание эндпоинтов сетевого мониторинга и аудита сессий ---

* Подсистема динамических селекторов (GET /api/get-target-*)
  Инфраструктурные роуты выгрузки баз данных, схем, таблиц и ролей защищены сквозным 
  перехватчиком сетевых таймаутов. В словари конфигураций принудительно 
  внедряется параметр "connect_timeout": 5. Любые обрывы связи или молчание 
  удаленного хоста PostgreSQL изолируются в блоки try-except, маскируя сырой traceback СУБД 
  в чистые JSON-ответы с кодом 500 для предотвращения разведки топологии сети.

* ИБ-Эндпоинт контроля и расследования инцидентов сессий (GET /api/auth/verify-role)
  Используется фронтендом для рантайм-контроля валидности JWT-токенов операторов. Внутренняя 
  логика жестко разделяет штатное протухание сессии и целенаправленную атаку деформации пакетов. 
  Истекший токен логируется с мягким уровнем INFO. Попытки подделки подписи или инжектов 
  перехватываются, маркируются уровнем CRITICAL под тегом [ИБ-АУДИТ] !!! КРИТИЧЕСКАЯ КОМПРОМЕТАЦИЯ СЕССИИ, 
  извлекают IP-адрес атакующего через прокси-заголовки Nginx (x-real-ip) и сбрасывают сокет.

--- Схема изоляции сетевой разведки инстансов СУБД ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">КОНТУР СЕТЕВОЙ РАЗВЕДКИ (POST /api/test-server-connection)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇ Presetting: db_config["connect_timeout"] = 5</td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ПОПЫТКА УСТАНОВЛЕНИЯ ПРЯМОГО TCP-СОЕДИНЕНИЯ С ХОСТОМ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Исполнение легковесного strict-запроса: SELECT 1;</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇ Каскадный перехват сетевых крахов</td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:10px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#14532d; font-weight:bold;">
            Узел доступен и ответил за 5с<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#166534;">utils.log_operation(status="success")<br>Ответ: HTTP 200 Подключение установлено!</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:10px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Узел мертв / Заблокирован Firewall<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#b91c1c;">logger.error([ИБ-АУДИТ] !!! СБОЙ ПОДКЛЮЧЕНИЯ)<br>Изоляция в HTTP 400 (Без вывода паролей и стека)</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ВЫСВОБОЖДЕНИЕ ДЕСКРИПТОРОВ СОКЕТОВ ИЗ RAM ПАМЯТИ
    </td>
  </tr>
</table>



