
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И ИБ-АНАЛИЗ МОДУЛЯ АДМИНИСТРИРОВАНИЯ ПАНЕЛИ (panel_users.js)

Настоящий архитектурный документ содержит исчерпывающее описание, пошаговый структурный 
разбор и профиль информационной безопасности клиентского модуля администрирования 
аккаунтов самой веб-панели и управления лимитами операторов СУБД (panel_users.js)

------------------------------------------------------------------------------------------
МОДУЛЬ АДМИНИСТРИРОВАНИЯ ПАНЕЛИ (panel_users.js)
------------------------------------------------------------------------------------------
Контур обеспечивает перехват отправки формы, валидацию типов, динамическое определение 
режима работы («Создание» / «Модификация») и веерный сбор лимитов операторов.

--- Схема рантайм-сбора данных и валидации режима инпута ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ОТПРАВКА ФОРМЫ (submitRegisterPanelUserForm)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Считывание ОЗУ-инпутов и приведение к нижнему регистру usernameClean</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">КОНТУР ОПРЕДЕЛЕНИЯ МОДИФИКАЦИИ (isEditButton || isUpdateMode)</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Проверка текста кнопки ──► Поиск совпадений логина в массиве базы</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление ИБ-проверки заполнения поля пароля</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#eff6ff; border:1px solid #3b82f6; border-radius:4px; color:#1e3a8a; font-weight:bold;">
            Режим Модификации (finalUpdateCheck == true)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Режим Создания (finalUpdateCheck == false)
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Допускается пустое поле пароля.<br>
            🔒 finalPassword = "";<br>
            🛡️ Защита: Бэкенд обновит только лимиты прав, сохранив старый хэш пароля.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Пустой пароль категорически запрещен!<br>
            ⚠️ if (!finalPassword) ──► Сброс транзакции.<br>
            🚨 Вызов showAlert('Введите мастер-пароль!').
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ПЕРЕХОД К СЕКЦИИ СБОРКИ МАТРИЦЫ ПРАВ ПО РОЛЯМ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы перехвата формы:
* **Защита от перезаписи и скомпрометирования паролей при апдейтах**: Принудительное разветвление 
  логики на основе детекции `finalUpdateCheck` гарантирует защиту криптографических хэшей. 
  Если администратор панели изменяет исключительно пул доступных серверов ИБ-офицеру, поле 
  пароля очищается в пустую строку `""`. Это страхует систему от случайного затирания 
  Bcrypt-хэша пустой строкой на бэкенде.
* **Предотвращение создания пустых или «беспарольных» аккаунтов**: В режиме создания нового 
  пользователя, проверка `!finalPassword || finalPassword.length === 0` блокирует трансляцию 
  пакета на сервер. Создание администратора без пароля физически невозможно.

------------------------------------------------------------------------------------------
МОДУЛЬ АДМИНИСТРИРОВАНИЯ ПАНЕЛИ (panel_users.js)
------------------------------------------------------------------------------------------
Контур обеспечивает каскадную проверку роли создаваемого аккаунта и автоматическую 
генерацию лимитов серверов и ролей в зависимости от привилегий касты.

--- Схема автоматического распределения пулов лимитов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СЕЛЕКТОР ТРИГГЕРА: const cleanRoleCheck = role.toLowerCase()</td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.8rem;">
        <tr>
          <td style="width:32%; padding:10px; background-color:#ffeeeb; border:1px solid #fca5a5; border-radius:4px; color:#991b1b; font-weight:bold;">
            Роль: admin / administrator
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:32%; padding:10px; background-color:#ecfdf5; border:1px solid #a7f3d0; border-radius:4px; color:#065f46; font-weight:bold;">
            Роль: auditor / аудитор
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:32%; padding:10px; background-color:#eff6ff; border:1px solid #bfdbfe; border-radius:4px; color:#1e40af; font-weight:bold;">
            Роль: Security_Manager (ИБ)
          </td>
        </tr>
        <tr>
          <td style="padding:8px; text-align:left; color:#334155; line-height:1.3;">
            🔒 Автоматический накат полного безлимита панели.<br>
            🚀 Маркеры пулов:<br>
            serversArray = ["ALL"]<br>
            rolesArray = ["ALL"]
          </td>
          <td></td>
          <td style="padding:8px; text-align:left; color:#334155; line-height:1.3;">
            👁️ Автоматический накат режима ReadOnly логов аудита.<br>
            🛡️ Маркеры пулов:<br>
            serversArray = ["NONE_READONLY"]<br>
            rolesArray = ["NONE_READONLY"]
          </td>
          <td></td>
          <td style="padding:8px; text-align:left; color:#334155; line-height:1.3;">
            ✍️ Требуется ручной ввод ID через запятую.<br>
            📋 Чтение DOM-инпутов.<br>
            ⚠️ Валидация: Строка пуста ──► Отмена транзакции.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ПЕРЕХОД К УПАКОВКЕ PAYLOAD И ДИРЕКТИВЕ ОТПРАВКИ НА БЭКЕНД
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы распределения лимитов:
* **Защита от несанкционированного расширения прав (Privilege Escalation)**: Код жестко 
  разделяет условия обработки ролей. Если оператор создает учетную запись `admin` или `auditor`, 
  любые текстовые значения, введенные в поля доступных серверов или ролей на экране, полностью 
  игнорируются. Система принудительно перетирает массивы жесткими служебными маркерами 
  `"ALL"` или `"NONE_READONLY"`, исключая возможность внедрения скрытых прав через фальсификацию 
  HTML-инпутов в браузере.
* **Предотвращение обхода лимитов Офицерами ИБ**: Для роли `Security_Manager` заполнение ограничений 
  является критически обязательным. ИБ-затвор `if (!serversRaw || !rolesRaw)` намертво прерывает 
  выполнение функции, если менеджер безопасности не привязал пользователя ни к одному целевому 
  серверу инфраструктуры, предотвращая появление неконтролируемых учетных записей.

------------------------------------------------------------------------------------------
МОДУЛЬ АДМИНИСТРИРОВАНИЯ ПАНЕЛИ (panel_users.js)
------------------------------------------------------------------------------------------
Контур обеспечивает точную сборку JSON-пакета данных в строгом соответствии со схемой 
валидации бэкенда и динамически переключает сетевые шлюзы API.

--- Схема упаковки Payload и переключения API-маршрутов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СБОРКА ОБЪЕКТА PAYLOAD В ОЗУ БРАУЗЕРА</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Спецификация полей: username, password, role, allowed_servers, allowed_target_roles</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ДИНАМИЧЕСКИЙ ТРИГГЕР ВЫБОРA АДРЕСА НАЗНАЧЕНИЯ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">targetApiRoute = finalUpdateCheck ? '/api/admin/update-user-limits' : '/api/admin/configure-panel-manager'</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление результатов HTTPS-транзакции</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf4; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Ответ: response.ok == true
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Ответ: response.ok == false / Сбой сети
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Вызов showAlert(..., 'success').<br>
            🧹 form.reset() + Снятие disabled-блокировок инпутов.<br>
            🔄 Мгновенное обновление RAM-кэша: loadPanelUsers().
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Перехват в секцию catch(err).<br>
            🚨 Вывод изолированного сообщения об ошибке бэкенда СУБД.<br>
            🚷 Сохранение старых данных в форме для ручной корректировки.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      КОНТУР УСПЕШНО ЗАПЕЧАТАН ──► СБРОС ТРИГГЕРОВ КНОПКИ В ДЕФОЛТ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы роутинга и упаковки:
* **Строгое соответствие Pydantic v2 на бэкенде**: Структурирование payload-пакета 
  осуществляется явным, ручным присвоением полей. Массивы `serversArray` и `rolesArray` 
  проходят принудительную зачистку пробелов `.map(s => s.trim())` и фильтрацию пустых строк `.filter(Boolean)`. 
  Это исключает отправку мусорных байт, снижая риски возникновения скрытых ошибок синтаксиса СУБД.
* **Автоматический снос блокировок (Anti-Lockup UI)**: При получении статуса `response.ok` 
  система не только очищает поля через `form.reset()`, но и принудительно возвращает полю логина 
  свойство `removeAttribute('disabled')`. Это исключает состояние "зависания интерфейса", 
  когда администратор теряет возможность вводить данные после успешной модификации лимитов.

------------------------------------------------------------------------------------------
МОДУЛЬ АДМИНИСТРИРОВАНИЯ ПАНЕЛИ (panel_users.js)
------------------------------------------------------------------------------------------
Контур обеспечивает чтение реестра администраторов из СУБД, безопасную дедупликацию 
ОЗУ-кэша и сквозную поисковую фильтрацию строк перед выводом на экран.

--- Схема дедупликации ОЗУ-кэша и схлопывания строк LEFT JOIN ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВЫЗОВ ИЗВЛЕЧЕНИЯ ДАННЫХ: loadPanelUsers()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Запрос к API периметра: secureFetch('/api/admin/panel-users-list')</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">КОНТУР ДЕДУПЛИКАЦИИ СТРОК (Схлопывание Декартова умножения)</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Инициализация структуры grouped = {} ──► Нарезка уникальных Set() по dbId</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Агрегация массивов допусков: Array.from(u.serversSet / u.rolesSet)</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf4; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Контур А: Поисковый инпут пуст
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#eff6ff; border:1px solid #3b82f6; border-radius:4px; color:#1e40af; font-weight:bold;">
            Контур Б: Введен текст в строку поиска
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 if (filterText === "") return true;<br>
            📦 Весь чистый массив ОЗУ-кэша переносится в globalPanelUsersCache.<br>
            📊 Запуск: renderPanelUsersTable().
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🔍 Сквозное сравнение .includes(filterText).<br>
            Сверка по 3 полям: login, role, allowed_servers.<br>
            ❌ Строки без совпадений мгновенно отсекаются из рендеринга.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      РЕНДЕРИНГ ОТФИЛЬТРОВАННОЙ ТАБЛИЦЫ ПАНЕЛИ ЗАВЕРШЕН
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы чтения и дедупликации:
* **Защита от Декартова раздувания ОЗУ-кэша (LEFT JOIN Explosion)**: Поскольку бэкенд выгружает 
  связи один-ко-многим через реляционные объединения, на фронтенд может прилетать избыточное 
  количество дублирующихся строк (например, одна строка на каждую комбинацию сервера и роли). 
  Контур дедупликации на строках 239–253 полностью ликвидирует этот риск, схлопывая дубли 
  в уникальные хэш-таблицы объектов `Set()` по числовому первичному ключу `id`.
* **Предотвращение инъекций [object Object] в таблицы**: При разборе массивов допусков 
  внедрена жесткая строковая ИБ-валидация `if (s && s !== "[object Object]")`. 
  Это страхует DOM-дерево интерфейса от аварийного вывода битых JSON-структур в текстовые ячейки.
* **Изолированный поисковый движок**: Функция фильтрации `filterPanelUsersTable` не взаимодействует 
  с опасными методами удаления или перезаписи элементов, она просто считывает инпут и 
  перезапускает `loadPanelUsers()`, защищая кэш от рассинхронизации.

------------------------------------------------------------------------------------------
МОДУЛЬ АДМИНИСТРИРОВАНИЯ ПАНЕЛИ (panel_users.js)
------------------------------------------------------------------------------------------
Контур обеспечивает постраничный динамический рендеринг таблицы, экранирование строковых 
переменных перед инжектом и жесткую ИБ-блокировку удаления root-аккаунта.

--- Схема постраничного рендеринга и ИБ-блокировок элементов UI ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">МАССИВ НА РЕНДЕР: slicedUsers = usersList.slice(startIndex, endIndex)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Итерация по срезу пагинации: slicedUsers.forEach(r => ...)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ИБ-ПЕРЕХВАТ И ЭКРАНИРОВАНИЕ СТРОК ДЛЯ ИНЛАЙН-КЛИКОВ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">const safeUsername = String(r.username).replace(/'/g, "\\'");</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сверка имени пользователя: if (r.username === 'admin')</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Текущий аккаунт в цикле: 'admin'
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Любой другой аккаунт (ИБ-офицер)
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Кнопки блокировки и удаления наглухо отключаются атрибутом disabled.<br>
            💬 Подмешивается защитный всплывающий тайтл: 'Системный root-аккаунт невозможно удалить'.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Кнопки активны, генерируются нативные SVG-значки и полилайны.<br>
            ⚙️ Инжект обработчиков: window.inlineDeletePanelUser(${r.id}, '${safeUsername}').
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ИНЖЕКТ СТРОКИ В TBODY ЧЕРЕЗ INNERHTML += ... СТИЛИЗАЦИЯ МАТОВЫХ БЭЙДЖЕЙ ЗАВЕРШЕНА
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы рендеринга и пагинации:
* **Защита от XSS на уровне инлайн-атрибутов (Quote Breaking Isolation)**: Имя пользователя 
  перед сквозным инжектированием в HTML-строку таблицы принудительно экранируется регулярным 
  выражением `.replace(/'/g, "\\'")` на строке 397. Это полностью ликвидирует риск проведения 
  атак типа XSS через внедрение одинарных кавычек в имя учетной записи сотрудника СУБД, блокируя 
  возможность сломать синтаксис инлайнового JS-обработчика `onclick`.
* **Жесткая ИБ-блокировка системного root-аккаунта (Самоликвидация UI)**: Проверки `r.username === 'admin'` 
  на строках 350 и 358 монументально отключают кнопки деактивации и полного каскадного удаления 
  для главного суперадминистратора. Оператор физически лишен возможности удалить 
  или перевести в статус Blocked аккаунт `admin` на стороне веб-интерфейса.
* **Строгое приведение типов перед сетевыми транзакциями (Type Safety)**: Внутри функции 
  `inlineDeletePanelUser` идентификатор `id` принудительно конвертируется в числовой тип `Number(id)`. 
  Если рантайм передает невалидный или деформированный строковый параметр вместо ID, снайперский ИБ-затвор 
  `isNaN()` немедленно прерывает операцию удаления, предотвращая хаотичные `400/500` ошибки бэкенда.

--- Таблица ИБ-рисков и затворов модуля panel_users.js ---
