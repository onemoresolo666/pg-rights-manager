
🔒 АРХИТЕКТУРНЫЙ ПАСПОРТ И ПАСПОРТ БЕЗОПАСНОСТИ КОНТУРА «USERS.PY»

Настоящий документ содержит исчерпывающее техническое и аналитическое описание модуля 
веерного управления учетными записями "users.py". Документ разработан в соответствии 
со стандартами ИБ-документирования для контуров высокой критичности. 

------------------------------------------------------------------------------------------
КОНТУР ВЕЕРНОГО СОЗДАНИЯ И АВТОМАТИЧЕСКОГО СБРОСА ПАРОЛЕЙ (POST /api/users)
------------------------------------------------------------------------------------------
Эндпоинт реализует централизованный веерный накат новых ролей пользователей на 
удаленные целевые кластеры PostgreSQL СУБД, а также реализует безопасный бесшовный 
сброс секретов (паролей) в случае обнаружения существующей учетной записи.

--- Схема потока данных эндпоинта создания ролей ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВХОДНОЙ JSON (CreateUserRequest)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Жесткий ИБ-барьер Depends(RoleChecker(["admin"]))</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: ПРОВЕРКА РОЛИ В СИСТЕМНОМ КАТАЛОГЕ СУБД</div>
      <div style="font-size:0.85rem; color:#94a3b8;">SELECT 1 FROM pg_roles WHERE rolname = %s (Изоляция через try-except)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление рантайм-логики</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#f0fdf4; border:1px solid #10b981; border-radius:4px; color:#14532d; font-weight:bold;">
            Роль отсутствует в pg_roles<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#166534;">CREATE ROLE {user} WITH LOGIN...</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#eff6ff; border:1px solid #3b82f6; border-radius:4px; color:#1e3a8a; font-weight:bold;">
            Роль найдена в pg_roles<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#1e40af;">ALTER ROLE {user} WITH PASSWORD...</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Генерация токена доступа UUIDv4 и шифрование пароля</span></td>
  </tr>
  <tr style="background-color:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">
    <td style="padding:15px; text-align:left; font-size:0.9rem; line-height:1.5;">
      💾 <strong>ИНЖЕКТ ПАНЕЛИ:</strong> Атомарный INSERT в локальную таблицу one_time_tokens служебной СУБД<br>
      📬 <strong>DELIVERY ШЛЮЗ:</strong> Сборка MIME-пакета, динамический парсинг TLS/STARTTLS и отправка<br>
      📝 <strong>АУДИТ-КОНТУР:</strong> utils.log_operation() ──► Фиксация CREATE_USER или RESET_PASSWORD
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px;">ФИНАЛ: СТАТУС SUCCESS (JSON ОТВЕТ БЕЗ ТЕХНИЧЕСКИХ ДАННЫХ)</td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты эндпоинта создания ролей:
* **Защита от инъекций (SQLi)**: Имя пользователя и сгенерированный пароль принудительно 
  проходят через класс-компилятор `psycopg.sql.Identifier` и `psycopg.sql.Literal`. Прямая 
  конкатенация строк или интерполяция переменных запрещены на уровне ядра, что полностью 
  блокирует любые векторы внедрения деструктивного DDL-кода.
* **Политика наименьших привилегий (Least Privilege)**: Все новые учетные записи создаются 
  в СУБД с принудительным, жестко вшитым в код бэкенда набором флагов ограничений: 
  `NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT`. Это гарантирует, что создаваемый 
  пользователь не сможет получить административный контроль над СУБД в обход ИБ-панели.
* **Криптографическая стойкость паролей**: Для генерации паролей задействован системный 
  модуль `secrets.choice`, использующий аппаратный генератор случайных чисел ОС (CSPRNG). 
  Длина секрета составляет строго 16 символов, алфавит включает 4 группы (строчные, 
  прописные буквы, цифры и спецсимволы), что полностью исключает атаки брутфорса.
* **Защита от дедлоков пула FastAPI**: Селектор существования учетной записи (`check_query`) 
  и DDL-запросы (`create/update`) полностью изолированы во внутренние индивидуальные блоки 
  `try-except Exception`. Любой сетевой крах, зависание удаленной СУБД или сброс 
  соединения немедленно перехватываются, сокеты освобождаются, а сырая трассировка стека 
  PostgreSQL маскируется контролируемым кодом ошибки `422 Unprocessable Entity`.

Эндпоинт осуществляет комплексное, необратимое и каскадное удаление учетной записи из 
ИТ-инфраструктуры организации, последовательно очищая глобальные доступы кластера и 
локальные списки контроля доступа (ACL) на уровне всех баз данных.

--- Схема потока данных контура аннигиляции прав ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ЗАПРОС УНИЧТОЖЕНИЯ РОЛИ (DeleteUserRequest)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сбор карты баз данных: SELECT datname FROM pg_database WHERE datallowconn</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">КОНТУР А: ОТЗЫВ ГЛОБАЛЬНЫХ ПРАВ ДОСТУПА В КЛАСТЕРЕ</div>
      <div style="font-size:0.85rem; color:#e2e8f0;">В цикле: REVOKE ALL PRIVILEGES ON DATABASE {db} FROM {user}</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Каскадный проход по локальным таблицам, сиквенсам и функциям</span></td>
  </tr>
  <tr style="background-color:#f8fafc; border:2px solid #e2e8f0;">
    <td style="padding:20px;">
      <div style="font-weight:bold; font-size:1.05rem; color:#0f172a; text-align:center; margin-bottom:15px; border-bottom:2px solid #cbd5e1; padding-bottom:8px;">КОНТУР Б: ТОТАЛЬНАЯ ЗАЧИСТКА ВНУТРЕННИХ ACL СХЕМЫ PUBLIC</div>
      <ul style="list-style-type:none; padding:0; margin:0; font-size:0.9rem; color:#334155; line-height:1.6;">
        <li style="margin-bottom:6px; padding-left:15px; border-left:3px solid #ef4444;"><strong>ОТЗЫВ ТАБЛИЦ:</strong> REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {user}</li>
        <li style="margin-bottom:6px; padding-left:15px; border-left:3px solid #ef4444;"><strong>ОТЗЫВ ПОСЛЕДОВАТЕЛЬНОСТЕЙ:</strong> REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {user}</li>
        <li style="margin-bottom:6px; padding-left:15px; border-left:3px solid #ef4444;"><strong>ОТЗЫВ ФУНКЦИЙ:</strong> REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM {user}</li>
        <li style="margin-bottom:10px; padding-left:15px; border-left:3px solid #f59e0b;">⏳ <strong>ИБ-ВЫПРЯМИТЕЛЬ ДЕДЛОКОВ:</strong> time.sleep(0.1) для сброса кэша системного каталога</li>
        <li style="margin-bottom:5px; padding-left:15px; border-left:3px solid #0f172a;"><strong>ОЧИСТКА ЗАВИСИМОСТЕЙ:</strong> REASSIGN OWNED BY {user} ──► DROP OWNED BY {user}</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Физическая аннигиляция роли: DROP ROLE {user}</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: СКВОЗНОЙ ЛОГ ОПЕРАЦИИ DROP_USER (КОД RESP 200 SUCCESS)
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты эндпоинта каскадного удаления:
* **ИБ-Выпрямитель блокировок и дедлоков каталога**: Изменение прав доступа и удаление роли 
  в PostgreSQL накладывает эксклюзивные блокировки (`AccessExclusiveLock`) на системные 
  таблицы `pg_authid` и `pg_shdepend`. На строке 396 внедрена принудительная микропауза 
  ядра `time.sleep(0.1)`, которая дает СУБД штатно освободить кэш зависимостей. Это полностью 
  ликвидирует риск возникновения мертвых блокировок (Deadlocks) и зависания сессий.
* **Предотвращение синтаксического падения транзакции**: Команды `REVOKE` обернуты во 
  внутренний локальный перехватчик `try-except` без аварийного завершения (`pass`). 
  Если у удаляемой роли отсутствовали права на конкретную таблицу или последовательность, 
  СУБД выдаст предупреждение, но общий транзакционный контур выполнения продолжится.
* **Безопасная обработка владения объектами (Data Ownership)**: Перед выполнением физического 
  удаления роли через `DROP ROLE`, скрипт атомарно переназначает владение всеми созданными 
  пользователем объектами на текущего администратора (`REASSIGN OWNED BY`). Это защищает 
  инфраструктуру от появления "объектов-сирот" с битыми ACL и гарантирует целостность СУБД.

<br><br>

Используется сотрудниками ИБ для мгновенной изоляции скомпрометированных ролей СУБД 
путем динамического переключения флагов авторизации ядра PostgreSQL.

--- Схема потока данных контура изменения статуса ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">JSON-ЗАПРОС СМЕНЫ СТАТУСА (LockUserRequest)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Барьер Depends(RoleChecker(["admin", "Security_Manager", "auditor"]))</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ВАЛИДАЦИЯ ОБЪЕКТА НА УДАЛЕННОМ ИНСТАНСЕ СУБД</div>
      <div style="font-size:0.85rem; color:#94a3b8;">SELECT 1 FROM pg_roles WHERE rolname = %s (connect_timeout = 5 секунд)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление по типу команды</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Параметр: req.action == "LOCK"<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#b91c1c;">Исполнение DDL: ALTER ROLE {user} NOLOGIN;</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Параметр: req.action == "UNLOCK"<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#047857;">Исполнение DDL: ALTER ROLE {user} LOGIN;</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px;">ФИНАЛ: СИНХРОНИЗАЦИЯ ЧЕРЕЗ UTILS.LOG_OPERATION() НА 8 ПАРАМЕТРОВ</td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты эндпоинта изменения статуса:
* **Защита от бесконечных таймаутов пула**: На соединение с удаленным сервером накладывается 
  жесткий лимит `server_config["connect_timeout"] = 5` секунд. Это полностью исключает 
  риск зависания рабочего потока FastAPI, если целевой хост СУБД внезапно ушел в офлайн 
  или заблокирован сетевым экраном.
* **Маскирование архитектуры корпоративной сети**: Любые низкоуровневые системные ошибки СУБД 
  перехватываются бэкендом, пишутся с полной трассировкой исключительно в закрытый логгер ОС РЕД ОС/CentOS 
  под тегом `[ИБ-КРАХ]`. Внешний фронтенд получает строго очищенное, абстрактное 
  сообщение `HTTP 500`, исключая утечки внутренней структуры метаданных и версий ПО наружу.

Атомарный криптографический роут без авторизации, обеспечивающий безопасный контролируемый 
вывод сгенерированного пароля СУБД сотруднику строго один раз, после чего секрет 
бесследно уничтожается в базе данных панели.

--- Схема атомарной самоликвидации секрета ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">КЛИК ПО ССЫЛКЕ ИЗ ПИСЬМА Оператором (token_id)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Запрос к service_manager_db (db_conn.autocommit = True)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ПРОВЕРКА СУЩЕСТВОВАНИЯ И ВРЕМЕНИ ЖИЗНИ ТОКЕНА</div>
      <div style="font-size:0.85rem; color:#94a3b8;">SELECT db_user, encrypted_password FROM one_time_tokens WHERE token_id = %s AND expires_at > %s;</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление рантайм-статуса сессии токена</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Токен сгорел / использован<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#b91c1c;">Ответ: 404 Ссылка устарела или уже открывалась</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Токен валиден (Первый клик)<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#047857;">Распаковка кортежа: db_user, decrypted_pass</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Мгновенное выжигание секрета внутри той же сессии</span></td>
  </tr>
  <tr style="background-color:#f1f5f9; color:#334155; border:1px solid #cbd5e1; text-align:center;">
    <td style="padding:15px; font-size:0.9rem; line-height:1.5;">
      ❌ <strong>DELETE FROM one_time_tokens WHERE token_id = %s;</strong><br>
      <span style="color:#64748b; font-size:0.8rem;">Секрет уничтожен из таблиц СУБД до вывода JSON на экран клиента</span>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px;">ФИНАЛ: ВЫВОД SECRETS И СТИРАНИЕ ДАННЫХ ИЗ RAM СЕРВЕРА</td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты эндпоинта раскрытия паролей:
* **Атомарная самоликвидация (Single-Use Token Link)**: Запрос на удаление токена (`DELETE`) 
  выполняется на бэкенде *строго внутри той же сессии* до того, как JSON-пакет будет передан 
  веб-сервером клиенту. Перехватить секрет повторно невозможно, даже если 
  злоумышленник получит доступ к почтовому ящику получателя позднее.
* **Защита от DOS-атак методом перебора UUID**: Для предотвращения умышленного переполнения 
  диска паразитным трейсом ошибок при подборе токенов, уровень логирования невалидных UUID 
  понижен до `logger.info`. Специфические сырые технические сообщения СУБД полностью скрыты.
* **Изоляция в оперативной памяти**: Скомпилированные расшифрованные текстовые пароли нигде 
  не сохраняются на диске хоста панели. Они обрабатываются исключительно в RAM-памяти 
  процесса uvicorn и бесследно стираются из памяти (Garbage Collector) сразу после возврата 
  HTTP-ответа пользователю.

<br><br>

Специализированный изолированный эндпоинт, разработанный по принципу разделения 
обязанностей (SoD — Separation of Duties) специально для Офицеров ИБ.

--- Схема потока данных контура Офицера ИБ ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВХОДНОЙ JSON (SecurityOnlyCreateRequest)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Затвор: if req.action_mode != "CREATE_ONLY" ──► HTTP 403 Forbidden</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ПРОВЕРКА НАЛИЧИЯ УЧЕТНОЙ ЗАПИСИ В pg_roles УДАЛЕННОГО ХОСТА</div>
      <div style="font-size:0.85rem; color:#94a3b8;">SELECT 1 FROM pg_roles WHERE rolname = %s (connect_timeout = 5 секунд)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление по результатам ИБ-проверки</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Роль уже существует в СУБД<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#b91c1c;">HTTP 400 Жесткий заслон изменения паролей админов</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#f0fdf4; border:1px solid #10b981; border-radius:4px; color:#14532d; font-weight:bold;">
            Роль полностью свободна<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#166534;">Исполнение CREATE ROLE и генерация токена доступа</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: КАНАЛ СВЯЗИ UTILS.LOG_OPERATION(SECURITY_CREATE_USER)
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты контура ИБ-Офицера:
* **Жесткое разделение полномочий (Principle of Segregation of Duties)**: Роут доступен исключительно 
  роли `Security_Manager`. Код бэкенда намертво блокирует логику сброса или изменения 
  паролей для существующих в кластере системных учетных записей. Если роль найдена, 
  вызывается `HTTP 400`. ИБ-Офицер лишен возможности скомпрометировать пароль 
  действующего Администратора СУБД, он уполномочен осуществлять исключительно первичный накат.
* **Защита от обхода бизнес-логики**: Принудительная проверка `if req.action_mode != "CREATE_ONLY"` 
  на строке 631 блокирует попытки манипуляции JSON-пакетами с фронтенда для обхода встроенных 
  ИБ-затворов.


