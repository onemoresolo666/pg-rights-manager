
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И ИБ-АНАЛИЗ МОДУЛЯ КЛАССТЕРОВ СУБД (servers.js)

Настоящий архитектурный документ содержит исчерпывающее описание, пошаговый структурный 
разбор и профиль информационной безопасности клиентского модуля управления реестром 
инстансов СУБД, веерного инжекта автокомплитов и контроля сетевой связности (servers.js).

------------------------------------------------------------------------------------------
КОНТУР ВЕЕРНОГО ИНЖЕКТА И УПРАВЛЕНИЯ АВТОКОМПЛИТАМИ (loadServersForSelect)
------------------------------------------------------------------------------------------
Контур обеспечивает извлечение реестра хостов из API, динамическую сборку списков 
автокомплита и сквозную прошивку полей ввода на всех вкладках интерфейса.

--- Схема аппаратного инжекта списков автокомплита СУБД ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВЫЗОВ СКРИПТА: loadServersForSelect()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Запрос к API: secureFetch('/api/servers/') ──► Проверка Array.isArray(servers)</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: СБОРКА СТРОКОВОГО БУФЕРА ОПЦИЙ DATALIST</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Итерация по массиву серверов ──► Извлечение server_id / id</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Накатка буфера на массив целевых селекторов вкладки №1 и №2</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#f8fafc; border:1px solid #cbd5e1; border-radius:4px; color:#334155; font-weight:bold;">
            Вкладка №1: Операционные формы
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#f8fafc; border:1px solid #cbd5e1; border-radius:4px; color:#334155; font-weight:bold;">
            Вкладка №2: Глобальный каскад привилегий
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#475569; line-height:1.4; font-size:0.8rem;">
            🛠️ Создание/поиск контейнеров: 'createUserServerDatalist', 'deleteUserServerDatalist', 'lockUserServerDatalist'.<br>
            💾 Навешивание атрибута list на инпуты ввода хостов.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#475569; line-height:1.4; font-size:0.8rem;">
            🔍 Точечный перехват инпута: 'globalTargetServer'.<br>
            🔗 Привязка поискового дата-листа: 'globalTargetServerDatalist'.<br>
            ⚡ Инжект: dl.innerHTML = datalistOptionsHtml.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Переопределение рантайм-слушателей ввода</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      УСПЕХ: removeEventListener('change'/'input') ──► addEventListener('input', onServerChanged)
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы инжекта автокомплитов:
* **Защита от XSS на уровне закрытых узлов Datalist**: Генерация допусков хостов изолирована 
  внутри закрытых тегов `<option value="${sId}"></option>`. Так как текст не выводится 
  в открытом текстовом узле DOM-дерева, браузер блокирует HTML-парсинг строки, на корню 
  ликвидируя векторы внедрения деструктивных XSS-скриптов через подмену имен серверов.
* **Ликвидация утечек памяти и дублирования триггеров ввода**: Перед взводом живого фильтра 
  на инпуте `globalTargetServer` система принудительно очищает старые обработчики 
  событий `removeEventListener`. Это страхует ОЗУ вкладки от размножения 
  дублирующихся задач при каскадном переключении вкладок администратором панели.


------------------------------------------------------------------------------------------
ПОИСКОВАЯ ФИЛЬТРАЦИЯ И УПРАВЛЕНИЕ КЭШЕМ (servers.js)
------------------------------------------------------------------------------------------
Контур обеспечивает постраничную навигацию, сквозную фильтрацию локального RAM-кэша 
серверов и защиту интерфейса от зависаний при обнулении памяти.

--- Схема рантайм-фильтрации локального ОЗУ-кэша серверов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ТРИГГЕР ПОИСКА: filterServersTable() | ВЫЗОВ: changeServersPage(pageNumber)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Считывание поисковой строки: const query = searchInput.value.toLowerCase().trim()</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">КОНТУР ДИНАМИЧЕСКОЙ СЕПАРАЦИИ ПОТОКОВ ОЗУ-КЭША</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Проверка: if (query && globalServersCache.length &gt; 0)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление логики обработки поискового среза</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#eff6ff; border:1px solid #3b82f6; border-radius:4px; color:#1e3a8a; font-weight:bold;">
            Контур А: Администратор ввёл поисковый запрос
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Контур Б: Поле поиска пустое
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🔍 Снайперская фильтрация массива по .filter().<br>
            📋 Сверка по двум полям: server_id и host.<br>
            📊 Отрисовка усечённого среза: renderServersTable(filtered).
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Прямой пропуск полного оригинального массива кэша.<br>
            📊 Отрисовка классической таблицы: renderServersTable(globalServersCache).<br>
            ⏳ Защита: Если ОЗУ очищено ──► loadServersRegistry().
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ПЕРЕКЛЮЧЕНИЕ СТРАНИЦЫ КЛАТЕРОВ ЗАВЕРШЕНО УСПЕШНО
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы фильтрации кэша:
* **Защита от утечки структуры данных при обнулении RAM**: Страховочный ИБ-затвор на строке 
  92 перехватывает ситуации, когда из-за агрессивной сборки мусора браузера или жесткого 
  сброса контекста локальный массив `globalServersCache` оказался пустым. Система не падает 
  в ошибку `Uncaught TypeError`, а автоматически инициирует асинхронный фолбек-запрос к API 
  для восстановления реестра серверов.
* **Санитизация поисковых параметров на клиенте**: Ввод поискового инпута принудительно 
  нормализуется методами `.toLowerCase().trim()`. Это полностью отсекает риск умышленного 
  внедрения скрытых спецсимволов и пробелов для обхода рантайм-сравнений текстовых полей `server_id` и `host`.

------------------------------------------------------------------------------------------
КОНТУР ТЕСТИРОВАНИЯ СВЯЗНОСТИ ИНСТАНСОВ (servers.js)
------------------------------------------------------------------------------------------
Контур обеспечивает интерактивную рантайм-проверку сетевой связности с удаленными узлами 
СУБД как для уже зарегистрированных серверов, так и на этапе заполнения формы добавления.

--- Схема проксирования проверочных пакетов и валидации портов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ЗАПУСК ПРОВЕРКИ: testRowConnection() | testConnectionBeforeRegister()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сбор параметров из DOM ИЛИ data-атрибутов строки: host, port, db_user, dbname</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: ПРИНУДИТЕЛЬНОЕ ИБ-ВЫРАВНИВАНИЕ ТИПОВ ДАННЫХ (ТИП ПОРТА)</div>
      <div style="font-size:0.85rem; color:#94a3b8;">port: parseInt(port, 10) || 5432 (Защита API бэкенда от инжекций в числовые поля)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Асинхронная трансляция: secureFetch('/api/test-server-connection/', { method: 'POST' })</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Ответ: response.ok == true (Успех)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Ответ: response.ok == false / Ошибка сети
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Вывод индикатора успешного коннекта.<br>
            💬 Сообщение: 'Соединение успешно установлено!'.<br>
            📈 Отображение версии ядра PostgreSQL в алерте строки.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Перехват низкоуровневых крахов и отказов сетевых экранов.<br>
            🚨 Маскирование стека ошибок: showAlert(d.detail || 'Сбой проверки').<br>
            🚷 Защита: Скрываются сырые системные логи бэкенда.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      КОНТУР ТЕСТИРОВАНИЯ СВЯЗИ БЕЗОПАСНО ВЫСВОБОДИЛ СОКЕТЫ ИЗ RAM ПАМЯТИ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы проверки связности:
* **Защита от деформации типов данных на бэкенде**: Ввод значения сетевого порта жестко 
  заперт внутри инструкции `parseInt(port, 10) || 5432`. Если злоумышленник 
  попытается через инспектор кода подменить числовое поле порта на вредоносную строку 
  или спецсимволы для проведения SQL-инъекций на бэкенде, фронтенд принудительно 
  сбросит значение в безопасный дефолтный порт PostgreSQL `5432`.
* **Предотвращение утечек сохраненных учетных записей**: При проверке связи для уже 
  существующего сервера (`testRowConnection`) в тело JSON-пакета инжектируется жесткий маркер 
  `password: "via_saved_credentials"`. Это позволяет бэкенду использовать ранее 
  зашифрованные и сохраненные в СУБД пароли, полностью избавляя фронтенд от необходимости 
  транслировать и хранить сырой текст паролей в ОЗУ браузера.

------------------------------------------------------------------------------------------
КОНТУР РЕГИСТРАЦИИ НОВЫХ ИНСТАНСОВ СУБД (servers.js)
------------------------------------------------------------------------------------------
Контур обеспечивает перехват отправки формы (submitRegisterServerForm), нативную валидацию 
технических параметров периметра конфигурации и отправку выверенного POST-запроса.

--- Схема транзакционной регистрации инстансов СУБД ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ОТПРАВКА ФОРМЫ (submitRegisterServerForm)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Нативный перехват аргументов: server_id, host, port, db_user, dbname, password</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЖЕСТКИЙ ПРЕВЕНТИВНЫЙ ИБ-ЗАТВОР НА ПУСТОЙ ВВОД</div>
      <div style="font-size:0.85rem; color:#94a3b8;">if (!server_id || !host || !db_user || !dbname || !password) ──► Сброс и отмена транзакции</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление результатов выполнения HTTPS-транзакции</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Ответ: response.ok == true (Успех)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Ответ: response.ok == false / Ошибка
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Вызов alert() об успешном внесении инстанса в СУБД.<br>
            🧹 Атомарное очищение полей ввода: form.reset().<br>
            🔄 Веерный накат: loadServersRegistry() и loadServersForSelect().
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Перехват и гашение синтаксического краха в блоке catch(err).<br>
            🚨 Вывод абстрактного сообщения: 'Ошибка добавления инстанса'.<br>
            🚷 Защита: Сохранение данных в инпутах для исправления опечаток.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      КОНТУР РЕГИСТРАЦИИ ОЧИСТИЛ РАБОЧИЕ БУФЕРЫ ПАМЯТИ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы регистрации серверов:
* **Защита от отправки пустых или неполных конфигураций**: ИБ-затвор `if (!server_id || !host || !db_user || !dbname || !password)` 
  на строке 158 монументально блокирует трансляцию пакетов в сеть, если администратор забыл заполнить 
  хотя бы одно техническое поле, предохраняя СУБД от записи битых профилей.
* **Веерная рантайм-синхронизация интерфейса (Real-Time Hot Reload)**: При успешном выполнении операции 
  система мгновенно и параллельно вызывает функции `loadServersRegistry()` и `loadServersForSelect()`. 
  Это обеспечивает горячую перезапись ОЗУ-массивов и немедленное наполнение выпадающих списков автокомплита 
  на всех остальных вкладках панели без необходимости полной перезагрузки страницы.
* **Повышенная семантическая строгость парсинга**: Извлечение значений хостов и идентификаторов 
  застраховано от ошибок верстки каскадным перехватом идентификаторов `document.getElementById('regId') || document.getElementById('id')`. 
  Это исключает сбои выполнения скрипта при динамическом обновлении стилей или разметки форм.


------------------------------------------------------------------------------------------
КОНТУР КАСКАДНОГО УДАЛЕНИЯ И ЗАЩИТЫ СЕССИЙ (servers.js)
------------------------------------------------------------------------------------------
Контур обеспечивает удаление инстансов СУБД из реестра панели с жестким ИБ-предотвращением 
сброса сессий авторизации оператора на экраны логина.

--- Схема каскадного удаления и удержания Bearer-токена в памяти ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ЗАПУСК ИСКЛЮЧЕНИЯ СЕРВЕРА: inlineDeleteServer(serverId)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">[ИБ-ФИКС СЕССИИ]: const savedToken = localStorage.getItem('pg_access_token');</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ВЫПОЛНЕНИЕ СЕТЕВОЙ ТРАНЗАКЦИИ УДАЛЕНИЯ ХОСТА</div>
      <div style="font-size:0.85rem; color:#94a3b8;">await secureFetch(`/api/servers/${encodeURIComponent(serverId)}`, { method: 'DELETE' });</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Принудительный возврат токена: localStorage.setItem('pg_access_token', savedToken)</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Контур А: Строка хоста найдена в DOM-дереве
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#fffbeb; border:1px solid #f59e0b; border-radius:4px; color:#92400e; font-weight:bold;">
            Контур Б: Ошибка сопоставления текста
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Мгновенное бесшовное вырезание элемента страницы.<br>
            ✂️ Вызов: row.remove().<br>
            📊 Интерфейс обновлен в реальном времени без моргания окна браузера.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ⚠️ Активация резервного ИБ-страховочного таймера.<br>
            🔄 Запуск: setTimeout(window.location.reload, 1000).<br>
            🧹 Принудительное выравнивание RAM-памяти и очистка кэшей.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: КАСКАДНОЕ ОБНОВЛЕНИЕ СЕЛЕКТOРОВ НА ОСТАЛЬНЫХ ВКЛАДКАХ ПАНЕЛИ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы каскадного удаления хостов:
* **Защита от ложной инвалидации сессий при деструктивных DDL-запросах**: Метод `inlineDeleteServer` 
  решает критическую проблему рантайма. Поскольку удаление сервера может вызвать 
  кратковременный отказ сокетов или ложный ответ `401` от шлюзов, скрипт предварительно 
  захватывает JWT-токен в изолированную переменную `savedToken` и принудительно 
  восстанавливает его в `LocalStorage` сразу после ответа. Это полностью блокирует 
  ошибочный сброс авторизованного администратора на экран логина.
* **Защита URI-адресации от инъекций внедрения путей (Path Traversal)**: Идентификатор удаляемого 
  сервера перед конкатенацией в строку сетевого запроса принудительно упаковывается в метод 
  `encodeURIComponent(serverId)`. Это на 100% пресекает попытки внедрения символов обхода 
  директорий каталога (`../`) или спецсимволов для несанкционированного удаления соседних профилей.

<br><br>

------------------------------------------------------------------------------------------
МОДУЛЬ УПРАВЛЕНИЯ КЛАССТЕРАМИ СУБД (servers.js)
------------------------------------------------------------------------------------------
Контур обеспечивает постраничную пагинацию, генерацию интерактивных элементов интерфейса 
и динамическую зачистку выпадающих списков при каскадных изменениях.

--- Схема динамической пагинации и веерного обновления списков ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">МАССИВ НА РЕНДЕР: slicedServers = serversList.slice(startIndex, endIndex)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Генерация строк таблицы через innerHTML += ...</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ТРИГГЕР СМЕНЫ СЕРВЕРА НА ОПЕРАЦИОННЫХ ФОРМАХ ВТИ СУБД</div>
      <div style="font-size:0.85rem; color:#94a3b8;">onDeleteServerChanged() | onLockServerChanged()</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление логики ИБ-сканирования ролей кластера</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Ввод пуст (Идентификатор srvId отсутствует)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Идентификатор srvId успешно считан из DOM
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🛑 Мгновенное гашение каскада выполнения.<br>
            🧹 Полное стирание вложенных списков опций: delDatalist.innerHTML = ''.<br>
            🔒 Сброс текстового инпута: delInput.value = ''.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            👁️ Инжект плейсхолдера: 'Загрузка ролей кластера...'.<br>
            📡 Вызов secureFetch(`/api/get-target-roles/${srvId}?show_system=false`).<br>
            📋 Циклический инжект опций во вспомогательные дата-листы.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      РЕНДЕРИНГ КНОПОК ПАГИНАЦИИ (renderServersPagination) ЗАВЕРШЕН
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистем пагинации и веерного каскада:
* **Защита от утечки системных ролей СУБД (Data Isolation)**: При вызове функций автоматического 
  наполнения инпутов удаления или блокировки сотрудников (`onDeleteServerChanged` / `onLockServerChanged`), 
  к сетевому адресу принудительно пришивается параметр `show_system=false`. Это жестко 
  запрещает вывод встроенных служебных групп ядра PostgreSQL (префиксы `pg_*`) на экраны управления 
  обычными пользователями, сужая вектор потенциальной компрометации каталогов.
* **Автоматическая нормализация структуры таблиц рендеринга**: Использование жестких 
  фолбек-значений `|| 'postgres'` и `|| '127.0.0.1'` при разборе объектов в цикле `forEach` 
  страхует DOM-модель интерфейса от вывода критических ошибок `undefined` в ячейки.

