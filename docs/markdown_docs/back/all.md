
🔒 СВОДНЫЙ КОНСУЛИДИРОВАННЫЙ ПАСПОРТ БЕЗОПАСНОСТИ И АРХИТЕКТУРЫ «PG_RIGHTS_MANAGER»

Документ представляет собой техническое описание и 
архитектурный паспорт, объединяющий зоны ответственности, 
механизмы межмодульного взаимодействия и транзакционные барьеры всех пяти компонентов 
асинхронного веб-интерфейса разграничения доступа СУБД PostgreSQL.

--- Единая сквозная схема движения данных панели ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВХОДЯЩИЙ ПАКЕТ ОПЕРАТОРА (ФРОНТЕНД)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Запрос к API периметру (main.py)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">1. ВХОДНАЯ ПРОВЕРКА И ВАЛИДАЦИЯ JWT СЕССИИ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Роутинг main.py ──► Вызов Depends(RoleChecker(["admin", "Security_Manager", "auditor"]))</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление по исполнительным модулям</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:32%; padding:12px; background-color:#ffffff; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:#1e293b;">
            Модуль panel_users.py<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#475569;">ACID накат матрицы внутренних лимитов операторов</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:32%; padding:12px; background-color:#ffffff; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:#1e293b;">
            Модуль users.py<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#475569;">Веерный DDL накат ролей, каскадная чистка ACL СУБД</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:32%; padding:12px; background-color:#ffffff; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:#1e293b;">
            Модуль smtp.py<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#475569;">Асинхронная почта, TLS/STARTTLS доставка токенов</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сквозные инфраструктурные сервисы (utils.py)</span></td>
  </tr>
  <tr style="background-color:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">
    <td style="padding:15px; text-align:left; font-size:0.9rem; line-height:1.5;">
      🔐 <strong>КРИПТОГРАФИЯ (Fernet):</strong> Расшифровка секретов серверов из RAM памяти процесса<br>
      🌀 <strong>ПОТОКОБЕЗОПАСНЫЙ ПУЛ (Psycopg3):</strong> Thread-Safe транзакции без Race Condition<br>
      📝 <strong>СКВОЗНОЙ ИБ-АУДИТ (log_operation):</strong> Локализация try-except, инжект в audit_logs
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Фиксация транзакций кластера</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      СЛУЖЕБНАЯ СУБД (service_manager_db) ──► УДАЛЕННЫЕ УЗЛЫ POSTGRESQL
    </td>
  </tr>
</table>

--- Расширенный профиль информационной безопасности по файлам ---

1. Модуль служебного ядра и криптографии (utils.py)
   * Уровень криптографической гигиены: Извлечение Fernet-ключей `MASTER_KEY` и параметров 
     подключения строго из оперативной памяти (`os.getenv`), полностью исключая хранение 
     секретов на накопителе хоста.
   * Изоляция многопоточного рантайма: Паттерн Double-Checked Locking совместно с мьютексом 
     `threading.Lock` предотвращает race condition и утечки дескрипторов сокетов. 
   * Отказоустойчивость подсистемы аудита: Функция `log_operation` изолирована верхнеуровневым 
     затвором `try-except pass`. Переполнение диска логами или обслуживание базы логов не способно 
     прервать или аварийно заблокировать основную бизнес-логику действий администратора.

2. Модуль веерного управления правами СУБД (users.py)
   * Защита от инъекций динамического DDL: Все операции создания, модификации и блокировки 
     ролей СУБД компилируются через токенизаторы `sql.Identifier` и `sql.Literal`.
   * Ликвидация взаимных блокировок (Deadlocks): Команды очистки каталога `REASSIGN` и `DROP OWNED` 
     разделены принудительной микропаузой ядра `time.sleep(0.1)`, предоставляя PostgreSQL 
     достаточно времени для пересчета графа системных зависимостей в таблице `pg_shdepend`.
   * Модель Single-Use Token: Одноразовые ссылки раскрытия паролей уничтожаются в БД панели 
     командой `DELETE` внутри той же транзакции до момента вывода JSON на экран клиента.

3. Модуль автоматизации и оповещений (smtp.py)
   * Предотвращение блокировок Event Loop: Тяжелые синхронные операции модификации файлов 
     конфигурации `.env` вынесены из общего контекста в пул потоков через `run_in_threadpool`.
   * Защита от MITM (Перехват сессии шлюза): Механизм автоматической сепарации портов (465 SSL / 587 STARTTLS) 
     надежно блокирует проведение умышленных атак на понижение уровня безопасности (Downgrade Attacks).

4. Модуль администрирования панели (panel_users.py)
   * ACID-транзакционность распределения лимитов: Сохранение допусков операторов к СУБД 
     выполняется атомарно при `conn.autocommit = False`. При сбое транзакция полностью откатывается, 
     исключая риски появления полунакатанных или битых лимитов в системе.
   * Затвор самоликвидации ядра: Код эндпоинтов намертво блокирует любые операции деактивации, 
     удаления или перевода в статус `NOLOGIN` для корневой системной учетной записи `admin`.

5. Главный служебный демон (main.py)
   * Безопасность сетевой разведки (Инфраструктурные селекторы): Любые Ajax-запросы перечисления 
     каталогов удаленных СУБД зажаты в жесткий лимит ожидания `connect_timeout=5` секунд. Сырые 
     ошибки PostgreSQL перехватываются, логируются в ОС под тегом `[ИБ-КРАХ]` и маскируются в плоский JSON.


