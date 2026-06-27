==========================================================================================
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И СХЕМАТИЧЕСКИЙ РАЗБОР МОДУЛЯ АДМИНИСТРИРОВАНИЯ (panel_users.py)
==========================================================================================

Настоящий документ содержит детальное архитектурное описание, профили безопасности 
и пошаговый структурный разбор всех исполнительных эндпоинтов модуля администрирования 
аккаунтов самой веб-панели и управления лимитами операторов.


------------------------------------------------------------------------------------------
МОДУЛЬ АДМИНИСТРИРОВАНИЯ ПАНЕЛИ (panel_users.py)
------------------------------------------------------------------------------------------
Эндпоинт обеспечивает атомарный ACID-накат и первоначальное конфигурирование учетных 
записей менеджеров панели СУБД с одновременной привязкой пулов разрешенных серверов и ролей.

--- Схема ACID-транзакции конфигурирования лимитов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВХОДНОЙ ПАКЕТ ПРИВИЛЕГИЙ (PanelUserCreateRequest)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Запуск ACID-сессии (conn.autocommit = False)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: ПРОВЕРКА СУЩЕСТВОВАНИЯ И ИНЖЕКТ ХЭША ПОЛЬЗОВАТЕЛЯ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">SELECT id -> INSERT (Режим нового) ИЛИ UPDATE (Режим модификации)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Атомарная зачистка старой ИБ-матрицы оператора</span></td>
  </tr>
  <tr style="background-color:#f1f5f9; color:#334155; text-align:center;">
    <td style="padding:10px; border:1px solid #cbd5e1;">
      <strong>ЭТАП Б: УДАЛЕНИЕ УСТАРЕВШИХ ЛИМИТОВ СТРОГО ПО USER_ID</strong><br>
      <span style="font-size:0.8rem; color:#64748b;">DELETE FROM panel_user_server_access & panel_user_role_limits</span>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Веерный циклический инжект новых допусков</span></td>
  </tr>
  <tr style="background-color:#f8fafc; border:2px solid #e2e8f0;">
    <td style="padding:20px;">
      <div style="font-weight:bold; font-size:1.05rem; color:#0f172a; text-align:center; margin-bottom:15px; border-bottom:2px solid #cbd5e1; padding-bottom:8px;">ЭТАП В: НАКАТ ОБНОВЛЕННОЙ МАТРИЦЫ ПРАВ (Циклы FOR)</div>
      <ul style="list-style-type:none; padding:0; margin:0; font-size:0.9rem; color:#334155; line-height:1.6;">
        <li style="margin-bottom:10px; padding-left:15px; border-left:3px solid #3b82f6;"><strong>1. СЕРВЕРНЫЙ ДОПУСК:</strong> Вставка разрешенных хостов СУБД в panel_user_server_access</li>
        <li style="margin-bottom:5px; padding-left:15px; border-left:3px solid #10b981;"><strong>2. РОЛЕВОЙ ЗАБОР:</strong> Вставка лимитов pg_* префиксов в panel_user_role_limits</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Запечатывание изменений в СУБД панели</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛЬНЫЙ КОММИТ (conn.commit()) | ОТКАТ ПРИ ОШИБКЕ (conn.rollback())
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы конфигурации лимитов:
* **ACID-транзакционность матрицы прав**: На операциях сохранения лимитов принудительно 
  отключается автокоммит (`conn.autocommit = False`). Каскадное удаление старых правил и 
  веерный инжект новых записей в циклах `for` выполняются атомарно. 
  При любом сетевом сбое или ошибке СУБД срабатывает `conn.rollback()`, защищая базу данных панели 
  от полунакатанных или деформированных лимитов операторов.
* **Предотвращение сохранения небезопасных секретов**: Входной инпут пароля прогоняется через 
  криптостойкий регулярный валидатор `validate_strong_password` (проверка длины `>= 64` символа, 
  наличия цифр, спецсимволов и разного регистра букв). На этапе сохранения 
  пароль хешируется по 12-раундному алгоритму Bcrypt (`hashpw`), исключая хранение открытого текста.
* **Ликвидация веерного дублирования записей (Фикс ошибки 500)**: Перед тем как вставить новые 
  связи допусков серверов и ролей, система принудительно выполняет превентивное удаление старых 
  записей по ключу `user_id`. Это на 100% ликвидирует риск падения СУБД по ошибкам 
  нарушения уникальности индексов при повторном перевыпуске прав оператора.

--- Подробное описание эндпоинтов управления пользователями ---

* Реестр администраторов и менеджеров безопасности (GET /api/admin/panel-users-list)
  Роут закрыт сквозной проверкой ролей RoleChecker(["admin", "Security_Manager", "auditor"]). 
  Использует суверенный оптимизированный SQL-запрос со вложенными подзапросами 
  string_agg(DISTINCT...). Это полностью исключает возникновение ошибки 
  Декартова умножения строк при одновременной выгрузке массивов серверов и ролей. 
  Сырые ошибки PostgreSQL маскируются, отдавая клиенту безопасный плоский JSON.

* Инлайн-смена паролей из строки таблицы мониторинга (PUT /api/panel-users/change-password)
  Доступ разрешен исключительно роли "admin". Входной инпут прогоняется через 
  криптостойкий регулярный валидатор validate_strong_password. Пароль 
  хешируется по 12-раундному алгоритму Bcrypt и заменяется в СУБД. 
  Вызов логгера приведен к жесткому стандарту из 8 параметров для исключения TypeError.

--- Схема каскадного удаления и затвора самоликвидации системы ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ЗАПРОС УДАЛЕНИЯ ПОЛЬЗОВАТЕЛЯ (DELETE /api/panel-users/{user_id})</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Вычитка имени по user_id до стирания</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ИБ-ПРОВЕРКА НА КОРНЕВОЙ АККАУНТ (username == "admin")</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление логики безопасности</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Попытка удалить "admin"<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#b91c1c;">Мгновенная блокировка: HTTP 400 Крическая защита</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Любой другой менеджер<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#047857;">Исполнение DELETE CASCADE (успешное удаление)</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center;">
    <td style="padding:12px; font-size:0.85rem;">
      utils.log_operation() ──► Сквозная фиксация инцидента или успеха в аудит-логе панели
    </td>
  </tr>
</table>



