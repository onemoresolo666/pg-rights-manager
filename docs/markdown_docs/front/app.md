
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И ИБ-АНАЛИЗ МОДУЛЯ ИНТЕРФЕЙСА JS (app.js)

Настоящий архитектурный документ содержит исчерпывающее описание, пошаговый структурный 
разбор и профиль информационной безопасности главного фронтенд-координатора и модуля 
динамического контроля доступа на стороне клиента (app.js)

--- Схема рантайм-инициализации клиента при холодном старте (HTML) ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СОБЫТИЕ: document.DOMContentLoaded</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Чтение хранилища: localStorage.getItem('pg_access_token')</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ПРОВЕРКА НАЛИЧИЯ ТОКЕНА АВТОРИЗАЦИИ В ПАМЯТИ</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление логики отображения контейнеров</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Токен отсутствует / Сброшен<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#b91c1c;">loginContainer.style.display = 'flex'<br>appContainer.style.display = 'none'</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Токен успешно обнаружен<br>
            <span style="font-size:0.75rem; font-weight:normal; color:#047857;">loginContainer.style.display = 'none'<br>appContainer.style.display = 'block'</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Запуск сквозных ИБ-фильтров отрисовки меню</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ИНИЦИАЛИЗАЦИЯ ВЫЗОВА: window.applyRoleBasedAccess(savedRole)
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы холодного старта:
* **Защита от утечки токенов сессий через кэширование**: Модуль принудительно разделяет 
  отображение рабочей области приложения (`appContainer`) и экрана авторизации (`loginContainer`). 
  Если токен стерт по таймауту или в ходе деавторизации, DOM-дерево основного функционала 
  панели намертво скрывается инструкцией `display: none`, блокируя несанкционированное 
  чтение остаточных метаданных интерфейса.
* **Повышение отказоустойчивости рендеринга профиля**: Логика вызова отрисовки бейджа 
  активного профиля в шапке `window.renderActiveUserProfileBadge()` изолирована строгой 
  проверкой `typeof === 'function'`. Это полностью исключает падение всего 
  скрипта инициализации по фатальной ошибке `TypeError`, если отдельные визуальные компоненты 
  шапки не успели загрузиться по сети.

Центральный оборонительный барьер фронтенда, осуществляющий динамическое маскирование, 
вырезание и деактивацию элементов интерфейса на основе роли активной сессии.

--- Матрица переключения слоев меню по принципу наименьших привилегий ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СЕЛЕКТОР ТРИГГЕРА: const currentRole = role || ... </td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#f0fdf4; border:1px solid #10b981; border-radius:4px; color:#14532d; font-weight:bold;">
            Текущая роль: Security_Manager
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#eff6ff; border:1px solid #3b82f6; border-radius:4px; color:#1e3a8a; font-weight:bold;">
            Текущая роль: admin
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Разрешены только вкладки ИБ-контроля.<br>
            ❌ Наглухо блокируются админские меню (panelUsersTab, panelSmtpTab).<br>
            🚷 Запуск Ликвидатора админских форм: скрываются элементы управления DATABASE, SCHEMA, TABLE.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Возврат к дефолтной безлимитной конфигурации панели.<br>
            ❌ Принудительно скрываются специализированные ИБ-вкладки и кнопки.<br>
            🔓 Все стандартные кнопки и формы разблокируются, возвращая pointer-курсоры.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; font-size:0.85rem;">
      ИБ-Фиксация: Запрет кликов по вкладкам дублируется в перехватчике tabButtons.addEventListener('click')
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы applyRoleBasedAccess:
* **Двухуровневый барьер блокировки несанкционированных кликов**: Защита от перехода 
  на запрещенные вкладки реализована дублированием условий. Даже если 
  пользователь попытается программно или через консоль сэмулировать клик по скрытой вкладке меню, 
  внутренний перехватчик событий `tabButtons.forEach` поймает событие клика, считает кэш роли 
  и вернет жесткий отказ `return false`, полностью прерывая рендеринг чужого контента.
* **Ликвидатор админских форм (DOM-Purge)**: Для роли `Security_Manager` (Офицер ИБ) модуль 
  не просто скрывает навигационные кнопки, но и осуществляет каскадный проход по элементам 
  внутри контейнера `.tab-content`. Все чужеродные карточки, заголовки, формы и 
  разделители, не входящие в белый список ИБ-функционала, принудительно вырезаются 
  из видимости свойствами `display: none !important`, `visibility: hidden !important` 
  и нулевым обнулением высоты элементов (`height: 0 !important`). Это полностью 
  исключает возможность визуального наложения элементов при сбоях CSS-стилей.
* **Переназначение обработчиков ввода на лету (Handler Hijacking Protection)**: При переключении 
  ролей модуль динамически переопределяет инлайновые атрибуты `oninput` для системных 
  селекторов выбора серверов и баз данных. Для ИБ-Офицера вызовы принудительно 
  замыкаются на функции `window.securityOnServerChanged()`, а для Администратора — 
  на дефолтные `window.onServerChanged()`, предотвращая сквозное выполнение несанкционированного кода.

Осуществляет жесткую рантайм-валидацию полезной нагрузки JWT-токена в оперативной памяти 
и безвозвратное физическое удаление недопустимых интерфейсных блоков из DOM-дерева страницы.

--- Схема работы жесткого UI-затвора удаления элементов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВЫЗОВ КОНТРОЛЛЕРА: applyRoleBasedUiAccessControl()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Извлечение сессионного токена: const sessionToken = localStorage.getItem('token')</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">БЕЗОПАСНАЯ РАСПАКОВКА PAYLOAD НА СТОРОНЕ КЛИЕНТА (atob)</div>
      <div style="font-size:0.85rem; color:#94a3b8;">split('.') ──► Считывание честной роли: tokenData.role</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сверка константы: if (cleanRole === 'security_manager')</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#14532d; font-weight:bold;">
            Вход Офицера Безопасности<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#166534;">createTabNavItem.style.display = 'block'<br>Допуск к экрану создания УЗ разрешен</span>
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Вход Суперадмина или иных ролей<br>
            <span style="font-size:0.8rem; font-weight:normal; color:#b91c1c;">Запуск вырезания: createTabNavItem.remove()<br>Элементы физически уничтожаются из DOM</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ГАРАНТИРОВАННЫЙ СТАРТ ЧЕРЕЗ TIMEOUT ПРИ ДОМ-ПРОГРУЗКЕ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы аннигиляции экранов:
* **Защита от подмены локальных переменных (Tampering)**: Модуль полностью игнорирует 
  текстовые переменные хранилища и осуществляет самостоятельную низкоуровневую распаковку 
  полезной нагрузки JWT-токена методом `atob()`. За честную и легитимную роль 
  принимается исключительно значение `tokenData.role`, подписанное секретным криптографическим 
  ключом бэкенда на сервере, что делает манипуляции в консоли бесполезными.
* **Физическое уничтожение элементов (DOM Annihilation)**: При обнаружении несоответствия 
  ролей модуль вызывает нативный метод `.remove()`. Элементы меню `createTabNavItem` 
  и сам экран формы `createTabContent` физически полностью стираются из памяти браузера. 
  Их невозможно восстановить, раскомментировать или отобразить через инспектор элементов.
* **Безаварийная песочница обработки ошибок**: Весь контур безопасности упакован в изолированный 
  блок `try-catch(err)`. Если атакующий передаст деформированный токен с целью вызвать падение 
  фронтенда, ошибка будет перехвачена, но критические функции навигации продолжат работу в штатном режиме.
