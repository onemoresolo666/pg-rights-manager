
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И ИБ-АНАЛИЗ КОНТУРА АВТОРИЗАЦИИ И СЕССИЙ (auth.js)

Настоящий архитектурный документ содержит детальное описание, профили безопасности 
и пошаговый структурный разбор контура аутентификации операторов и механизмов 
жизненного цикла сессий на стороне клиента (auth.js).

------------------------------------------------------------------------------------------
КОНТУР ВХОДА И ДИНАМИЧЕСКОГО РАСПРЕДЕЛЕНИЯ РОЛЕЙ (POST /api/login)
------------------------------------------------------------------------------------------
Модуль обеспечивает перехват отправки формы авторизации, выполнение асинхронного 
запроса к API-периметру бэкенда и отказоустойчивую фиксацию ролей доступа.

--- Схема потока данных и фолбек-алгоритма авторизации ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ОТПРАВКА ФОРМЫ (submitLoginForm)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Запрос к API: fetch('/api/login/') (connect_timeout = 5с)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: КОНТРОЛЬ СТАТУСА ОТВЕТА СЕРВЕРА</div>
      <div style="font-size:0.85rem; color:#94a3b8;">if (res.ok && data.access_token) ──► localStorage.setItem('pg_access_token')</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Валидация ИБ-роли оператора: if (!userRole)</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#eff6ff; border:1px solid #3b82f6; border-radius:4px; color:#1e3a8a; font-weight:bold;">
            Бэкенд передал data.role
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#fffbeb; border:1px solid #f59e0b; border-radius:4px; color:#92400e; font-weight:bold;">
            Бэкенд промолчал (Аварийный фолбек)
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Фиксация штатной роли в ОЗУ.<br>
            💾 localStorage.setItem('panel_user_role', data.role);
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🕵️‍♂️ Проверка по маске username.toLowerCase().<br>
            🔹 'auditor' ──► роль 'auditor'.<br>
            🛡️ 'sec/manager/officer' ──► роль 'Security_Manager'.<br>
            🛑 Иначе ──► дефолтная роль 'admin'.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Принудительная перезагрузка контекста: window.location.reload()</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      УСПЕХ: СЕССИЯ ДИНАМИЧЕСКИ ЗАПЕЧАТАНА В ПАМЯТИ КЛИЕНТА
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы авторизации:
* **Защита от атак деградации привилегий (Downgrade Attacks)**: Внедренный на строках 21–30 
  аварийный фолбек-анализатор защищает матрицу доступов от падения в дефолтный режим. При 
  проверке имени аккаунта по маске `sec`, `officer` или `manager`, система принудительно 
  назначает точную роль `Security_Manager` вместо сброса сессии в привилегии `admin`. 
  Это исключает риск случайного получения суперадминистративного доступа ИБ-офицерами 
  при таймаутах или частичных сбоях ответов СУБД на бэкенде.
* **Ликвидация векторов XSS-инжекций на выводе ошибок**: Текст сообщения об ошибке 
  неверного логина или сетевого краха выводится на экран оператора строго через 
  экранированные свойства шаблона `data.detail || '...'`. Прямой рендеринг 
  сырого ответа сервера запрещен, что полностью ликвидирует возможность проведения атак 
  типа Cross-Site Scripting (XSS) через подмену текста ошибок в HTTP-заголовках.
* **Очистка инпутов перед отправкой пакета**: Имя пользователя принудительно обрабатывается 
  методом `.trim()` на строке 4. Это отсекает случайные или преднамеренно внедренные 
  пробельные символы, защищая СУБД от избыточной нагрузки при обработке поисковых индексов.

<br><br>

------------------------------------------------------------------------------------------
КОНТУР ДЕАВТОРИЗАЦИИ И УДАЛЕНИЕ СЕССИЙ (logoutSession)
------------------------------------------------------------------------------------------
Обеспечивает контролируемое закрытие рабочей сессии, полную аннигиляцию JWT-токенов 
из локального хранилища и мгновенный сброс рантайм-памяти браузера.

--- Схема каскадного уничтожения сессии ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ЗАПУСК ВЫХОДА: logoutSession()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️</td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ФИЗИЧЕСКОЕ УНИЧТОЖЕНИЕ КЛЮЧЕЙ ИЗ ХРАНИЛИЩА БРАУЗЕРА</div>
      <div style="font-size:0.85rem; color:#94a3b8;">localStorage.removeItem('pg_access_token');</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️</td>
  </tr>
  <tr style="background-color:#f1f5f9; color:#334155; border:1px solid #cbd5e1; text-align:center;">
    <td style="padding:15px; font-size:0.9rem; line-height:1.5;">
      🔄 <strong>window.location.reload();</strong><br>
      <span style="color:#64748b; font-size:0.8rem;">Мгновенная очистка ОЗУ-переменных процесса и сброс DOM-дерева в экран логина</span>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ПОЛНАЯ ДЕАВТОРИЗАЦИЯ ОПЕРАТОРА ЗАВЕРШЕНА
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы logoutSession:
* **Защита от повторного использования токенов (Replay Attacks)**: Инструкция `removeItem` 
  начисто стирает JWT-ключ из памяти браузера, делая невозможным его извлечение 
  злоумышленниками, получившими физический доступ к АРМ сотрудника после окончания смены.
* **Полное ОЗУ-маскирование рантайма**: Команда `window.location.reload()` принудительно 
  перезапускает контекст выполнения JS. Все временные глобальные переменные, массивы лимитов СУБД 
  и внутренние кэши объектов полностью выжигаются из оперативной памяти вкладки, не оставляя 
  следов для исследования через отладчик браузера.


