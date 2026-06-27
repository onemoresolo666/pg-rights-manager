
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И СХЕМАТИЧЕСКИЙ РАЗБОР МОДУЛЯ СЛУЖЕБНОГО ЯДРА (utils.py)

Настоящий документ содержит детальное архитектурное описание и структурный разбор 
всех низкоуровневых подсистем безопасности, криптографии, пулинга и сквозного аудита 
служебного ядра панели.

------------------------------------------------------------------------------------------
КОНТУР ВАЛИДАЦИИ СЕССИЙ И СХЕМА АВТОРИЗАЦИИ (PyJWT / HS256)
------------------------------------------------------------------------------------------
Контур обеспечивает перехват входящих запросов, криптографическую проверку подписей 
Bearer-токенов операторов и жесткое разграничение доступов по модели RBAC.

--- Схема потока данных контура авторизации и RBAC ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВХОДЯЩИЙ HTTP-ЗАПРОС (Bearer Token)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Криптографическое декодирование: jwt.decode(token, JWT_SECRET)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ПРОВЕРКА ВАЛИДНОСТИ ПОДПИСИ И СТРУКТУРЫ PAYLOAD</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Извлечение метаданных: username = payload.get("sub"), role = payload.get("role")</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Перехват исключений рантайма валидатора</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:32%; padding:10px; background-color:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; color:#475569; font-weight:bold;">
            jwt.ExpiredSignatureError<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#64748b;">Мягкий лог: [ИБ-АУДИТ] Сессия истекла по таймауту. Ответ: HTTP 401</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:32%; padding:10px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            jwt.InvalidSignatureError<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#b91c1c;">Жёсткий лог: [ИБ-АТАКА] Попытка входа с поддельным токеном! Ответ: HTTP 401</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:32%; padding:10px; background-color:#fffbeb; border:1px solid #f59e0b; border-radius:4px; color:#92400e; font-weight:bold;">
            jwt.PyJWTError<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#b45309;">Предупреждение: [ИБ-АУДИТ] Общая ошибка структуры пакета. Ответ: HTTP 401</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сравнение роли: if user_role not in self.allowed_roles</span></td>
  </tr>
  <tr style="background-color:#ffeeeb; color:#991b1b; text-align:center; font-weight:bold; border:1px solid #fca5a5;">
    <td style="padding:12px; font-size:0.9rem;">
      БЛОКИРОВКА ДОСТУПА ПРИ СБОЕ СВЕРКИ: [ИБ-НАРУШЕНИЕ] !!! ОТКАЗ В ДОСТУПЕ ──► HTTP 403 Forbidden
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      УСПЕХ: ВЕРИФИКАЦИЯ ПРОЙДЕНА ──► ПРОПУСК К ЦЕЛЕВОМУ ЭНДПОИНТУ
    </td>
  </tr>
</table>

Обеспечивает синхронизацию тяжелых межпоточных операций рантайма и криптографическую 
декомпрессию секретов удаленных СУБД из изолированной RAM-памяти процесса.

--- Схема работы пула по паттерну Double-Checked Locking ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВЫЗОВ ИНИЦИАЛИЗАЦИИ ПУЛА: init_pool()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Первичная проверка: if db_pool is not None ──► Мгновенный выход</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЗАХВАТ МЕЖПОТОЧНОГО МЬЮТЕКСА СИНХРОНИЗАЦИИ</div>
      <div style="font-size:0.85rem; color:#e2e8f0;">with pool_lock: (Блокировка параллельных потоков рантайма uvicorn)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Вторичная проверка внутри затвора (Double-Check)</span></td>
  </tr>
  <tr style="background-color:#f8fafc; border:2px solid #e2e8f0;">
    <td style="padding:20px;">
      <div style="font-weight:bold; font-size:1.05rem; color:#0f172a; text-align:center; margin-bottom:15px; border-bottom:2px solid #cbd5e1; padding-bottom:8px;">ИБ-ЗАТВОР ВАЛИДАЦИИ ОКРУЖЕНИЯ .ENV</div>
      <ul style="list-style-type:none; padding:0; margin:0; font-size:0.9rem; color:#334155; line-height:1.6;">
        <li style="margin-bottom:6px; padding-left:15px; border-left:3px solid #ef4444;"><strong>ЖЕСТКИЙ ФИЛЬТР:</strong> if not db_name or not db_user or not db_pass ──► Вызов ValueError</li>
        <li style="margin-bottom:6px; padding-left:15px; border-left:3px solid #10b981;"><strong>СБОРКА DSN:</strong> env_dsn = f"dbname={db_name} user={db_user} password={db_pass}..."</li>
        <li style="margin-bottom:10px; padding-left:15px; border-left:3px solid #3b82f6;"><strong>ИНИЦИАЛИЗАЦИЯ ПУЛА:</strong> ConnectionPool(min_size=2, max_size=10, open=True)</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Вызов дешифратора секретов: global_cipher.decrypt(row[4].encode())</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ВЫДАЧА ЧИСТОГО СЛОВАРЯ КЛАСТЕРУ С ТАЙМАУТОМ CONNECT_TIMEOUT=5С
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистем пула и дешифрования:
* **Защита от состояния гонки (Race Condition)**: Одновременный вызов создания пула из разных 
  асинхронных потоков при старте или массовом Ajax-запросе заблокирован примитивом `threading.Lock`. 
  Паттерн двойной проверки исключает повторную инициализацию сокетов и утечки дескрипторов.
* **Безопасная обработка скомпрометированных ключей**: При падении криптомодуля Fernet 
  из-за попытки прочитать пароли удаленной СУБД сбитым или подмененным ключом `MASTER_KEY`, 
  ядро изолирует сбой в блок `except Exception as crypt_err`. Ошибка пишется в журнал логов ОС 
  как `[ИБ-КРАХ] Фатальный сбой криптографии`, а наружу отдается чистый код `HTTP 500`.
* **Автоматическое выпрямление транзакционной чистоты**: Параметры пула жестко зашиты в 
  режим `autocommit=True` с ограничением лимита `connect_timeout=5` секунд. Это гарантирует, 
  что грязные или незакрытые сессии операторов будут очищены ядром СУБД панели автоматически.
