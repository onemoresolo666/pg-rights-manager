
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И ИБ-АНАЛИЗ КОНТУРА ОФИЦЕРА БЕЗОПАСНОСТИ (security_rights.js)

Настоящий архитектурный документ содержит исчерпывающее описание, пошаговый структурный 
разбор и профиль информационной безопасности специализированного фронтенд-контура, 
предназначенного для изоляции действий Менеджеров безопасности (security_rights.js).

Все алгоритмы распила JWT-токенов, веерного наполнения селекторов, проверки кадрового 
совпадения логинов и санитизации полей переведены в пуленепробиваемые HTML-модели таблиц. 
Это гарантирует стопроцентное сохранение пропорций, выравнивания и геометрии элементов 
на страницах итогового PDF-документа.

------------------------------------------------------------------------------------------
КОНТУР ИЗОЛЯЦИИ И УПРАВЛЕНИЯ ПРАВАМИ ИБ (security_rights.js)
------------------------------------------------------------------------------------------
Контур обеспечивает запуск механизма вычитки DSN серверов, снайперское извлечение Payload 
активной сессии оператора из заголовков JWT и защиту от повторного входа.

--- Схема декомпрессии Payload JWT и блокировки гонки селекторов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВЫЗОВ СЛУЖБЫ: securityLoadServersForSelect()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Затвор гонки: if (window.isIbSelectorLoading) ──► Мгновенный откат</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: ПЕРЕХВАТ И ДЕКОДИРОВАНИЕ СЕССИОННОГО КЛЮЧА ИБ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">localStorage.getItem('pg_access_token') ──► sessionToken.split('.')</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Криптографический разбор полезной нагрузки в ОЗУ</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Контур А: Декодирование успешно пройeno
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#fffbeb; border:1px solid #f59e0b; border-radius:4px; color:#92400e; font-weight:bold;">
            Контур Б: JWT поврежден / отсутствует
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Вызов: atob(base64) + decodeURIComponent().<br>
            ✍️ Чтение полей: tokenData.sub || tokenData.username.<br>
            💾 Фиксация: cleanTargetUser = логин оператора.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ⚠️ Активация резервного шага страховки.<br>
            📋 localStorage.getItem('username').<br>
            🧹 Санитизация: Срезание кавычек через regex .replace(/^["']|["']$/g, '').
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ПЕРЕХОД К ЭТАПУ СВЕРКИ КАДРОВОГО СОВПАДЕНИЯ СЕССИЙ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы инициализации ИБ-контура:
* **Защита от атак повторного запроса и перегрузки ОЗУ (Race Condition)**: Атомарный маркер 
  `window.isIbSelectorLoading = true` на строке 19 полностью блокирует отправку повторных 
  или параллельных запросов выгрузки списков серверов, если предыдущая транзакция 
  еще не завершила рендеринг DOM-дерева в браузере.
* **Многоуровневая верификация личности оператора (Anti-Spoofing)**: Извлечение логина 
  выполняется снайперским распилом токена `sessionToken.split('.')` и нативным парсингом 
  payload. Текстовые переменные локального кэша используются исключительно 
  как резервный фолбек при недоступности JWT, при этом проходя обязательную санитизацию 
  регулярным выражением от кавычек, ликвидируя риск инжекций.

------------------------------------------------------------------------------------------
КОНТУР ИЗОЛЯЦИИ И УПРАВЛЕНИЯ ПРАВАМИ ИБ (security_rights.js)
------------------------------------------------------------------------------------------
Контур осуществляет фильтрацию глобального реестра серверов на основе принципа жесткой 
кадровой изоляции и собирает уникальный массив допусков для текущей сессии.

--- Схема кадровой фильтрации и сборки допусков хостов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">РЕЕСТР ИЗ API: const userRes = await secureFetch('/api/admin/panel-users-list')</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Считывание числового ID: mySessionUserId = Number(myProfileObj.id)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">КОНТУР СТРОГОГО КАДРОВОГО ФИЛЬТРА ОПЕРАТОРА ПАНЕЛИ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">usersList.filter(u => u.username.toLowerCase() === cleanTargetUser)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление рантайм-логики валидатора лимитов</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Уникальный Set() хостов пуст (uniqueOptions.size == 0)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Обнаружены легитимные привязки серверов
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🛑 Полная блокировка контура управления ИБ.<br>
            💬 Написание опции: 'У вашего профиля нет разрешенных серверов'.<br>
            🔒 Навешивание принудительного атрибута setAttribute('disabled', 'true').
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🔤 Алфавитная сортировка массива хостов: .sort().<br>
            🛠️ Генерация чистых HTML-тегов option value="${finalServerName}".<br>
            🔓 Атомарный снос блокировок: removeAttribute('disabled').
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ВЕЕРНАЯ ИНЪЕКЦИЯ ДАННЫХ В ОБA СЕЛЕКТOРА ЭКРАНА ЗАВЕРШЕНА
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы кадровой изоляции:
* **Защита от межпользовательской компрометации (Horizontal Privilege Escalation)**: Фильтр 
  на строках 72–78 жестко отсекает любые чужие записи лимитов из памяти. Инструкция 
  `return dbUser === cleanTargetUser` гарантирует, что ИБ-офицер получит доступ строго к тем 
  серверам кластера, которые были явно привязаны к его учетной записи Суперадминистратором, 
  блокируя несанкционированный просмотр структуры чужих хостов.
* **Предотвращение инъекций мусорных байт**: При итерации по массиву `srvData` внедрен 
  жесткий затвор `s !== 'all' && s !== 'none_readonly' && s !== '[object object]'`. 
  Это блокирует попытки вывести системные маркеры безлимита или текстовые ошибки рендеринга 
  в выпадающий список селектора, обеспечивая абсолютную чистоту DOM-инпутов.

------------------------------------------------------------------------------------------
КОНТУР ИЗОЛЯЦИИ И УПРАВЛЕНИЯ ПРАВАМИ ИБ (security_rights.js)
------------------------------------------------------------------------------------------
Контур обеспечивает двухкаскадную асинхронную подгрузку доступных баз данных и ролей СУБД 
для выбранного инстанса, блокируя отображение неразрешенных объектов.

--- Схема каскадного наполнения баз данных и сканирования ролей ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ТРИГГЕР ИЗМЕНЕНИЯ СЕРВЕРА (securityOnServerChanged)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Запрос баз: secureFetch(`/api/get-target-databases/${serverId}`)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: НАПОЛНЕНИЕ СЕЛЕКТOРА БАЗ И ПЕРЕХОД К НАЖАТИЮ (securityOnDatabaseChanged)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Параллельный опрос системных/кастомных групп: Promise.all()</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#eff6ff; border:1px solid #3b82f6; border-radius:4px; color:#1e3a8a; font-weight:bold;">
            Поток 1: Кастомные роли (show_system=false)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#f0fdf4; border:1px solid #10b981; border-radius:4px; color:#14532d; font-weight:bold;">
            Поток 2: Системные группы (show_system=true)
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Вычитка массива ролей из dataCustom.roles.<br>
            📦 Прямое добавление в уникальное ОЗУ-множество uniqueUsers.add().
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🛡️ Вычитка системных префиксов pg_*.<br>
            🔍 Сверка с лимитами Офицера: panel_user_allowed_roles.<br>
            ❌ Отсечение несанкционированных групп.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: СОРТИРОВКА И ВЫВОД РАЗРЕШЕННЫХ ПОЛЬЗОВАТЕЛЕЙ В СЕЛЕКТОР
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы каскадного сканирования:
* **Мгновенная изоляция интерфейса при смене фокуса (UI-Reset)**: При каждом изменении 
  выбранного сервера или базы данных, элемент управления `secInlinePanel` принудительно 
  скрывается инструкцией `display: none !important`. Это исключает риск проведения 
  операций с устаревшим контекстом (например, выдачу прав на сервере Б, когда на экране всё 
  ещё отображаются параметры сервера А).
* **Снайперский контроль системных групп доступа СУБД**: При разборе системных ролей 
  алгоритм сверяет каждую позицию с локальным кэшем разрешенных ролей оператора. 
  ИБ-офицеру разрешено увидеть и выбрать только ту группу (например, `pg_checkpoint`), которая 
  была явно делегирована ему администратором панели, исключая горизонтальный перехват контроля.
* **Превентивный инжект суперпользователя (Root Guard)**: В строку 226 вшит принудительный 
  инжект `uniqueUsers.add('postgres')`. Это гарантирует, что корневой аккаунт СУБД 
  всегда доступен для экстренных манипуляций со стороны Менеджера безопасности.

------------------------------------------------------------------------------------------
КОНТУР ИЗОЛЯЦИИ И УПРАВЛЕНИЯ ПРАВАМИ ИБ (security_rights.js)
------------------------------------------------------------------------------------------
Контур обеспечивает реактивное извлечение и сопоставление веерного пула разрешенных ролей 
текущего оператора панели на основе перехвата его идентификатора user_id.

--- Схема динамического сбора разрешенных ролей оператора из RAM ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВЫБОР ЦЕЛЕВОЙ РОЛИ СУБД: securityOnUserSelected()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Декодирование логика оператора из JWT по ключу sub / username</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: СОПОСТАВЛЕНИЕ ИМЕНИ С ЧИСЛОВЫМ USER_ID В СУБД</div>
      <div style="font-size:0.85rem; color:#94a3b8;">myProfileObj = usersList.find(...) ──► Изоляция строк строго по user_id</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Агрегация лимитов: const myAllowedRoles = activeRoleForDisplay.split(',')</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            В базе отсутствуют лимиты ролей оператора
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Пул ролей успешно сгруппирован в ОЗУ
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🛑 Полная блокировка инлайн-выпадающего списка.<br>
            💬 Инжект: 'У вашего профиля нет разрешённых ролей...'.<br>
            🔒 Отключение главной кнопки submitBtn.setAttribute('disabled', 'true').
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🔤 Алфавитная сортировка уникального Set-массива.<br>
            🛠️ Генерация опций инпута + removeAttribute('disabled').<br>
            👁️ Активация плиты управления: inlinePanel.style.display = 'flex'.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ВСЕ ВЕЕРНЫЕ РОЛИ ИЗ МАТРИЦЫ ПРАВ ВЫВЕДЕНЫ НА ЭКРАН ОПЕРАТОРА
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы сбора разрешенных ролей:
* **Защита от подмены лимитов через кэш браузера**: Алгоритм осуществляет 
  извлечение `user_id` текущего оператора панели путем побитового парсинга Payload. 
  Затем он выполняет прямую фильтрацию `usersList.filter` по жестко вычисленному `mySessionUserId`. 
  Попытка подменить текстовый массив ролей в консоли браузера блокируется, так как система 
  пересчитывает лимиты по связи из базы данных.
* **Резервный автономный контур (Air-Gapped Fallback)**: Если API бэкенда недоступен из-за сетевого сбоя, 
  логика бесшовно переключается на защищенный ОЗУ-кэш `window.globalPanelUsersCache`. При этом 
  массив повторно фильтруется строго по совпадению `cleanOpName`, исключая сбои рендеринга.
* **Жесткая ИБ-блокировка при отсутствии прав**: Если у профиля оператора в базе отсутствуют 
  разрешенные системные группы, инпут окрашивается в красный ИБ-маркер `#ef4444`, а кнопка 
  выполнения полностью блокируется, прерывая деструктивный трафик в сеть.

------------------------------------------------------------------------------------------
КОНТУР ИЗОЛЯЦИИ И УПРАВЛЕНИЯ ПРАВАМИ ИБ (security_rights.js)
------------------------------------------------------------------------------------------
Контур обеспечивает перехват отправки формы (secSubmitCustomRoleAssign), динамическое 
считывание направления транзакции (GRANT или REVOKE) и жесткую ИБ-идентификацию оператора 
для предотвращения анонимных модификаций.

--- Схема верификации сессии и наката/отзыва системных групп ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ЗАПУСК ТРАНЗАКЦИИ: secSubmitCustomRoleAssign()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Считывание направления: currentAction = actionSelect.value ('GRANT' / 'REVOKE')</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ТРЕХУРОВНЕВЫЙ ИБ-ЗАТВОР ИДЕНТИФИКАЦИИ СЕССИИ ОПЕРАТОРА</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Уровень 1: Распил JWT ──► Уровень 2: Кэш ОЗУ Хрома ──► Уровень 3: Чтение DOM-шапки</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сверка переменной: if (!foundUsername || foundUsername === "unknown")</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Имя оператора НЕ определено (Сбой сессии)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Имя оператора успешно зафиксировано
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🛑 Жесткий ИБ-отказ: Снятие выполнения снайперским затвором.<br>
            🚨 Вызов showAlert('Не удалось идентифицировать активную сессию!').<br>
            🔓 Снятие disabled-блокировок с главной кнопки.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🔤 Санитизация логина регулярным выражением: .toLowerCase().<br>
            📦 Упаковка universalPayload (Инжект оператора в тело пакета).<br>
            📡 Трансляция на FastAPI: secureFetch('/api/manage-system-roles').
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ВЫЗОВ СЛУЖБЫ ОБНОВЛЕНИЯ РЕЕСТРА АДМИНИСТРАТОРОВ (loadPanelUsers)
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы наката прав:
* **Жесткий стоп-затвор подмены личности (Anti-Anonymization Barrier)**: ИБ-контроллер на строках 
  463–470 наглухо рубит отправку пакета на бэкенд, если рантайм не смог динамически верифицировать 
  логин оператора, выполняющего GRANT/REVOKE. Это полностью исключает анонимный накат прав 
  в обход сквозного журнала ИБ-аудита (`operator: finalOperator`).
* **Предотвращение зависания кнопок (Anti-Freeze Guard)**: Блок выполнения обёрнут в 
  интегрированную секцию `finally`, которая при любом исходе транзакции (успех, крах СУБД, 
  ошибка сети) гарантированно вызывает `submitBtn.removeAttribute('disabled')`. 
  Это исключает парализацию интерфейса оператора.

------------------------------------------------------------------------------------------
КОНТУР ИЗОЛЯЦИИ И УПРАВЛЕНИЯ ПРАВАМИ ИБ (security_rights.js)
------------------------------------------------------------------------------------------
Контур обеспечивает изолированное создание учетных записей сотрудников Офицером ИБ 
с принудительной отправкой паролей на корпоративную почту и жестким маскированием 
сетевых ошибок.

--- Схема изолированного создания учетных записей сотрудников ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ЗАПУСК СОЗДАНИЯ РОЛИ: securitySubmitOnlyCreateUser()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Валидация полей формы: if (!server || !username || !email)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ДЕКОДИРОВАНИЕ ИМЕНИ ОФИЦЕРА ИЗ ПАКЕТА JWT</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Изоляция сессии: currentOp = String(parsed.sub || parsed.username)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Упаковка неизменяемого затвора: action_mode = "CREATE_ONLY"</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Ответ: response.ok == true
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Ответ: response.ok == false / Сбой СУБД
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Вызов showAlert(..., 'success').<br>
            🧹 Мгновенная зачистка текстовых полей формы создания роли сотрудника.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Перехват сырых технических ошибок СУБД.<br>
            🚨 Маскирование и вывод абстрактного алерта: 'Отказ СУБД: Сбой'.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ВЫЗОВ SECTION FINALLY ДЛЯ СНЯТИЯ DISABLED-БЛОКИРОВОК КНОПКИ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы изолированного создания УЗ:
* **Жесткое вшивание ИБ-режима (Hardcoded Action Enforcement)**: Параметр `action_mode: "CREATE_ONLY"` 
  намертво зашит в JS-код сборщика payload-пакета на строках 584–586. Даже если злоумышленник 
  модифицирует HTML-форму на экране, бэкенд на Python принудительно получит маркер создания, 
  блокируя Офицеру ИБ любую возможность обойти правила Separation of Duties (SoD) и сбросить пароль 
  действующего суперадминистратора.
* **Предотвращение повторных кликов при медленном SMTP-ответе**: Процесс генерации роли и 
  отправки письма на почту может занимать до нескольких секунд. Затвор `submitBtn.setAttribute('disabled', 'true')` 
  на строке 538 полностью исключает риск повторной отправки дублирующихся пакетов при 
  сетевых задержках почтового реле-сервера.

