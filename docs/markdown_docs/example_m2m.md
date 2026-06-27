
🔌 РУКОВОДСТВО ПО ИНТЕГРАЦИИ API (M2M AUTOMATION)

Настоящий документ содержит исчерпывающие сценарии межпрограммного взаимодействия 
с асинхронным бэкендом панели для автоматизации процессов заведения учетных записей, 
блокировки операторов и наката DDL-прав.

--- Схема сквозной межпрограммной координации доступов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВНЕШНЯЯ СИСТЕМА АВТОМАТИЗАЦИИ (IDM / IAM / CI-CD)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Шаг 0: POST-запрос на /api/login ──► Сбор JSON: {"access_token": "ey..."}</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">МАССИВ ПАКЕТОВ: ИНЖЕКТ ЗАГОЛОВКА AUTHORIZATION</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Headers: {"Authorization": "Bearer ey...", "Content-Type": "application/json"}</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление по исполнительным сервисным эндпоинтам</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:32%; padding:12px; background-color:#eff6ff; border:1px solid #3b82f6; border-radius:4px; color:#1e3a8a; font-weight:bold;">
            1. Создание роли в СУБД
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:32%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            2. Точечный накат прав
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:32%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            3. Блокировка в панели
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.78rem;">
            📡 <code>/api/manage-roles</code><br>
            🔒 Режим: CREATE_ONLY.<br>
            📬 Выдача одноразовых UUID-паролей на Email сотрудника.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.78rem;">
            📡 <code>/api/manage-privileges</code><br>
            🎯 Режим: SINGLE_TABLE.<br>
            📋 Снайперский лог: фиксация чистого имени объекта без масок.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.78rem;">
            📡 <code>/api/admin/update-user-status</code><br>
            🛑 Флаг: is_active=false.<br>
            🔒 Root Guard: блокиратор учетки admin.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

--- Таблица структуры вызова интеграционных эндпоинтов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden; font-size:0.85rem;">
  <tr style="background-color:#1e293b; color:#ffffff; font-weight:bold; text-align:center;">
    <td style="padding:12px; width:30%; border-right:1px solid #334155;">Маршрут и Метод API</td>
    <td style="padding:12px; width:45%; border-right:1px solid #334155;">Эталонный JSON Payload запроса</td>
    <td style="padding:12px; width:25%;">ИБ-Предохранитель</td>
  </tr>
  <tr style="border-bottom:1px solid #e2e8f0;">
    <td style="padding:12px; font-family:monospace; background-color:#f8fafc; border-right:1px solid #e2e8f0;"><strong>POST</strong><br>/api/manage-roles</td>
    <td style="padding:12px; font-family:monospace; background-color:#ffffff; color:#0f172a; border-right:1px solid #e2e8f0; white-space:pre-wrap;">{
  "target_server": "prod-db-01",
  "username": "kuznetsov_am",
  "target_email": "kuzn@co.ru",
  "action_mode": "CREATE_ONLY"
}</td>
    <td style="padding:12px; color:#334155;">Запрещает сброс или перехват чужих паролей в СУБД.</td>
  </tr>
  <tr style="border-bottom:1px solid #e2e8f0;">
    <td style="padding:12px; font-family:monospace; background-color:#f8fafc; border-right:1px solid #e2e8f0;"><strong>POST</strong><br>/api/manage-privileges</td>
    <td style="padding:12px; font-family:monospace; background-color:#ffffff; color:#0f172a; border-right:1px solid #e2e8f0; white-space:pre-wrap;">{
  "target_server": "prod-db-01",
  "target_db": "orders_db",
  "username": "app_reader",
  "scope": "TABLE",
  "schema_name": "public",
  "table_name": "clients_cards",
  "action": "GRANT",
  "privilege": "SELECT"
}</td>
    <td style="padding:12px; color:#334155;">Фикс логов: пишет в аудит реальный объект без мусорных масок.</td>
  </tr>
  <tr>
    <td style="padding:12px; font-family:monospace; background-color:#f8fafc; border-right:1px solid #e2e8f0;"><strong>POST</strong><br>/api/admin/update-user-status</td>
    <td style="padding:12px; font-family:monospace; background-color:#ffffff; color:#0f172a; border-right:1px solid #e2e8f0; white-space:pre-wrap;">{
  "username": "fired_user",
  "is_active": false,
  "status": "NOLOGIN"
}</td>
    <td style="padding:12px; color:#334155;">Жестко блокирует попытки заморозить root-аккаунт admin.</td>
  </tr>
</table>

------------------------------------------------------------------------------------------
ПРИМЕРЫ СЦЕНАРИЕВ ИНТЕГРАЦИИ (PYTHON / CURL)
------------------------------------------------------------------------------------------
Внедрение этих проверенных фрагментов гарантирует корректную передачу авторизационных заголовков.

--- Python-скрипт выдачи GRANT-прав на одну таблицу ---
```python
import requests

# Шаг 0. Получение Bearer-токена под служебным аккаунтом IDM
auth_payload = {"username": "idm_service_account", "password": "VeryStrongPassword2026"}
auth_res = requests.post("https://company.ru", json=auth_payload, timeout=5)
token = auth_res.json().get("access_token")

# Настройка защищенных HTTP-заголовков сессии
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Payload автоматического наката привилегий на таблицу после миграции CI/CD
privilege_payload = {
    "target_server": "prod-db-01",
    "target_db": "orders_db",
    "username": "app_reader",
    "scope": "TABLE",
    "schema_name": "public",
    "table_name": "clients_cards",
    "action": "GRANT",
    "privilege": "SELECT"
}

response = requests.post("https://company.ru", json=privilege_payload, headers=headers, timeout=10)
print(response.json())
```

--- Bash-команда экстренной блокировки скомпрометированного сотрудника ---
```bash
# 1. Атомарное извлечение JWT-токена из JSON-ответа авторизации
TOKEN=\$(curl -s -X POST "https://company.ru" \
  -H "Content-Type: application/json" \
  -d '{"username": "idm_service_account", "password": "VeryStrongPassword2026"}' \

  | grep -o '"access_token":"[^"]*' | grep -o '[^"]*\$')

# 2. Перевод аккаунта в статус NOLOGIN через служебный REST-шлюз
curl -s -X POST "https://company.ru" \
  -H "Authorization: Bearer \$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "fired_user", "is_active": false, "status": "NOLOGIN"}'
```

