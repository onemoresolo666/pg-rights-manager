
🔒 УСТАНОВКА НА CENTOS

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СПЕЦИФИКАЦИЯ ХОСТА: CentOS Stream 10 (Kernel 6.12)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Выделенные ресурсы: 6 CPU | 8GB RAM | 30GB SSD/NVMe</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">МАТРИЦА ОТКРЫТЫХ СЕТЕВЫХ ПОРТОВ (FIREWALLD)</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Вход: 443 (HTTPS), 80 (Redirect) ──► Изоляция локального ядра на localhost:8000</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление рантайм-переменных (play.yml)</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#eff6ff; border:1px solid #3b82f6; border-radius:4px; color:#1e3a8a; font-weight:bold;">
            Внешний токен-маршрут (Порт 443)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Технический контур СУБД (Порт 5432)
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            📬 Переменная: dns_usertoken_name.<br>
            🔗 Назначение: генерация ссылок для отправки UUID-паролей на почту сотрудников.<br>
            🔒 Защита: TLS-шифрование сессии.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ⚙️ Переменная: core_admin_password.<br>
            💾 Назначение: авторизация службы pgrights_core_admin в service_manager_db.<br>
            🚷 Закрыто: внешние коннекты запрещены.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
    </td>
  </tr>
</table>

### 🛠️ Список компонентов которые будут проинсталированы на сервер:

   * `epel-release;`
   * `python3-pip;`
   * `python3-devel;`
   * `gcc;`
   * `ansible;`
   * `rsync;`
   * `nginx;`
   * `postgresql18;`
   * `postgresql18-server;`
   * `postgresql18-contrib;`
   * `fastapi0.136.1;`
   * `uvicorn0.47.0;`
   * `psycopg3.3.4;`
   * `psycopg-binary3.3.4;`
   * `psycopg-pool3.3.1;`
   * `pydantic2.13.4;`
   * `PyJWT2.12.1;`
   * `cryptography48.0.0;`
   * `bcrypt5.0.0;`
   * `passlib1.7.4;`
   * `aiosmtplib5.1.0;`
   * `email-validator2.3.0;`

### 🛠️ Инструкция по установке:

1. **Подготовка и установка Ansible на хост:**
   Выполните последовательную установку пакетов сборщика и pip-компонентов в консоли ОС:
   * `dnf install epel-release -y;`
   * `dnf install python3-pip python3-devel gcc -y;`
   * `pip3 install ansible;`
   * `shutdown -r now;`

2. **Локальное размещение дистрибутива:**
   Скопируйте все конфигурационные файлы, шаблоны и SQL-темлейты плейбука в хом администратора (например, `/root/`).

3. **Заполнение обязательных переменных:**
   Откройте файл `play.yml` и заполните переменные:
   * `core_admin_password`: Пароль овнера базы данных `service_manager_db`.
   * `dns_usertoken_name`: Базовый URL-адрес (например, `pgrights.company.ru`), по которому сотрудники будут переходить из писем для безопасного одноразового раскрытия паролей по порту 443.
   * `ssl_hostname`: Валидное DNS или SSL имя хоста для генерации сертификатов Nginx.

4. **Запуск плейбука:**
   `ansible-playbook -i hosts.ini play.yml`

### 🛠️ Инструкция по замене ssl сертификатов:
1. **Запустить плейбук:**
   `ansible-playbook -i hosts.ini renew_ssl_serts.yml`


Для посгрес выставлены настройки под 8GB и 6CPU в случае расширения/уменьшения ресурсов на хосте следует изменить параметры в templates\db_schema.sql.j2.

```sql

-- --- БЛОК ОПТИМИЗАЦИИ ОЗУ И КЭШЕЙ ПАНЕЛИ ---
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '300MB';
ALTER SYSTEM SET random_page_cost = 1.1;

-- --- КОНТУР ПАРАЛЛЕЛЬНОГО СКАНИРОВАНИЯ КАТАЛОГОВ ---
ALTER SYSTEM SET max_worker_processes = 6;
ALTER SYSTEM SET max_parallel_workers = 6;
ALTER SYSTEM SET max_parallel_workers_per_gather = 3;
ALTER SYSTEM SET max_parallel_maintenance_workers = 3;

-- --- АВТОВАКУУМ ---
ALTER SYSTEM SET autovacuum = 'on';
ALTER SYSTEM SET autovacuum_max_workers = 2;
ALTER SYSTEM SET autovacuum_naptime = '1min';
ALTER SYSTEM SET autovacuum_work_mem = '256MB';
ALTER SYSTEM SET autovacuum_vacuum_threshold = 50;
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.05;
ALTER SYSTEM SET autovacuum_analyze_threshold = 25;
ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.02;
ALTER SYSTEM SET autovacuum_vacuum_cost_delay = '2ms';
ALTER SYSTEM SET autovacuum_vacuum_cost_limit = 400;
```


