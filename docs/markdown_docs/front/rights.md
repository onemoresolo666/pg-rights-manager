
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И ИБ-АНАЛИЗ МОДУЛЯ ВЕЕРНОГО НАКАТА ПРАВ (rights.js)

Настоящий архитектурный документ содержит исчерпывающее описание, пошаговый структурный 
разбор и профиль информационной безопасности клиентского модуля веерного распределения 
привилегий и ведения журналов аудита СУБД (rights.js).

------------------------------------------------------------------------------------------
МОДУЛЬ ВЕЕРНОГО НАКАТА ПРАВ (rights.js)
------------------------------------------------------------------------------------------
Контур обеспечивает перехват событий изменения селекторов, очистку буферов ввода 
и жесткую фильтрацию некорректных или потенциально опасных строковых параметров.

--- Схема фильтрации сетевого дребезга инпута серверов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СОБЫТИЕ СЕЛЕКТОРА СЕРВЕРОВ (onServerChanged)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Считывание значения: const serverId = serverInput.value.trim()</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЖЕСТКИЙ ПРЕВЕНТИВНЫЙ ИБ-БАРЬЕР ФИЛЬТРАЦИИ СТРОК</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Длина &lt; 3 ИЛИ Наличие кириллицы (/[а-яА-Я]/) ИЛИ Текст-заглушка</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление логики безопасности</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Условие фильтра сработало (Строка опасна/пуста)
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Строка валидна (Проверка пройдена)
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🛑 Стопорение трансляции пакетов в сеть!<br>
            🧹 Каскадная зачистка буферов (dbInput, roleInput).<br>
            🔒 Принудительная блокировка setAttribute('disabled', 'true').
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Изменение плейсхолдера: 'Сбор баз данных...'.<br>
            🚀 Передача управления асинхронному fetch-шлюзу бэкенда.<br>
            📡 Вызов secureFetch(`/api/get-target-databases/...`).
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ИНИЦИАЛИЗАЦИЯ ЗАПРОСА В КЛАСТЕР ВЫПОЛНЕНА СТРОГО ШТАТНО
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы фильтрации ввода:
* **Защита от сетевого дребезга и переполнения пула (DoS Protection)**: ИБ-барьер на строках 
  23–27 наглухо блокирует отправку Ajax-запросов к API при вводе 1-2 букв, пустых строк 
  или дефолтных системных плейсхолдеров (`"Выберите сервер..."`). Это разгружает 
  инфраструктурный пул соединений бэкенда от паразитных сетевых таймаутов.
* **Фильтрация инжектов на уровне кодировок (Кириллический заслон)**: Проверка регулярным 
  выражением `/[а-яА-Я]/.test(serverId)` изолирует ввод русских букв в идентификаторы хостов. 
  Это ликвидирует возможность проведения Unicode-инжектов и атак на системный каталог СУБД.

------------------------------------------------------------------------------------------
МОДУЛЬ ВЕЕРНОГО НАКАТА ПРАВ (rights.js)
------------------------------------------------------------------------------------------

Контур обеспечивает обработку успешных сетевых ответов от СУБД, безопасную генерацию 
списков допусков объектов и внедрение глобальных маркеров веерного наката привилегий.

--- Схема инжекта Enterprise-опций и активации каскада инпутов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ОТВЕТ СЕРВЕРА: response.ok == true (data.databases)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Инициализация строкового буфера рендеринга: let html = ''</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ВНЕДРЕНИЕ GLOBAL ENTERPRISE-ОПЦИИ ВЕЕРНОГО НАКАТА НА ВСЕ БАЗЫ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">html += `&lt;option value="ALL"&gt;ВСЕ БАЗЫ ДАННЫХ (ALL)&lt;/option&gt;`;</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Циклическая сборка: dbs.forEach(db =&gt; ...)</span></td>
  </tr>
  <tr style="background-color:#f8fafc; border:2px solid #e2e8f0; text-align:center;">
    <td style="padding:15px;">
      <strong>ЭТАП Б: СНЯТИЕ ДЕФОЛТНЫХ БЛОКИРОВОК И НАВЕШИВАНИЕ СЛУШАТЕЛЕЙ</strong><br>
      <span style="font-size:0.85rem; color:#0f172a; font-weight:bold;">dbInput.removeAttribute('disabled');</span><br>
      <span style="font-size:0.8rem; color:#64748b;">Устранение дубликатов утечек памяти: removeEventListener() ──► addEventListener('input', onDatabaseChanged)</span>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: АКТИВАЦИЯ СЛЕДУЮЩЕГО ЯРУСА АВТОКОМПЛИТА СУБД
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы сборки баз данных:
* **Защита от утечек слушателей событий и краша ОЗУ**: При каждой успешной подгрузке 
  списка баз данных, перед назначением триггера ввода на элемент `dbInput` выполняется 
  принудительное выжигание старого слушателя `removeEventListener('input', onDatabaseChanged)`. 
  Это на 100% ликвидирует риск утечек памяти вкладки браузера (Memory Leaks) при многократном 
  динамическом переключении серверов инфраструктуры.
* **Предотвращение XSS-инъекций на этапе генерации списков допусков**: Наполнение 
  дата-листов СУБД изолировано внутри закрытого строкового буфера `let html`. Переменные 
  `db` инжектируются строго в виде значений атрибутов `value="${db}"` внутри тегов `<option>`. 
  Поскольку они не рендерятся в открытом текстовом узле, браузер не выполняет HTML-парсинг 
  строки, что полностью блокирует атаки внедрения вредоносных тегов через имена баз данных.

------------------------------------------------------------------------------------------
МОДУЛЬ ВЕЕРНОГО НАКАТА ПРАВ (rights.js)
------------------------------------------------------------------------------------------

Контур обеспечивает перехват событий второго каскада (onDatabaseChanged), мгновенную 
очистку хвостов управления при пустых инпутах и блокировку сетевого дребезга.

--- Схема защиты бэкенда от сетевого дребезга при вводе имени базы ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СОБЫТИЕ МОДИФИКАЦИИ ПОЛЯ БАЗ (onDatabaseChanged)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Считывание ОЗУ-констант: srvId и dbName</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ИБ-БАРЬЕР №1: ОЧИСТКА ХВОСТОВ КАСКАДА ПРИ ПУСТОМ ИНПУТЕ</div>
      <div style="font-size:0.85rem; color:#94a3b8;">if (!srvId || !dbName || dbName === "") ──► Блокировка нижних ярусов</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">ИБ-БАРЬЕР №2: АНТИ-ДРЕБЕЗГ ПО ДЛИНЕ СТРОКИ</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Длина dbName < 3 символов (Исключение: 'ALL')
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Длина dbName >= 3 символов ИЛИ равна 'ALL'
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🛑 Мгновенное гашение выполнения транзакции через return.<br>
            🚷 Запрет отправки сырых пакетов на бэкенд на каждом нажатии клавиши сотрудником.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Активация плейсхолдера: 'Сбор учётных записей...'.<br>
            🚀 Запуск параллельных fetch-потоков подгрузки ролей и схем.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      КОНТУР КОНТРОЛЯ ВВОДА УСПЕШНО ОЧИСТИЛ СЕТЕВУЮ СЕССИЮ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы анти-дребезга:
* **Защита бэкенда от DoS-переполнения сетевым дребезгом (Debounce Protection)**: Без затвора 
  длины строки `if (dbName.length < 3)` послойный ввод оператором слова из 8 букв породил бы 
  8 тяжелых параллельных SQL-запросов к каталогам `pg_roles` и `pg_namespace`. 
  Жесткое отсечение обрубков менее 3 символов намертво блокирует паразитный трафик до ввода 
  осмысленного корня имени базы данных.
* **Предотвращение бесконечных циклов блокировок на 'ALL'**: ИБ-выпрямитель содержит явное 
  исключение `&& dbName !== 'ALL'`. Это позволяет Enterprise-опции тотального веерного 
  наката проскакивать проверку длины без задержек, мгновенно перестраивая нижние селекторы.

------------------------------------------------------------------------------------------
МОДУЛЬ ВЕЕРНОГО НАКАТА ПРАВ (rights.js)
------------------------------------------------------------------------------------------

Контур обеспечивает тотальный перевод интерфейса в глобальный режим веерного наката 
при выборе маркера "ALL", принудительно перестраивая нижние ярусы селекторов схем и таблиц.

--- Схема перевода интерфейса в глобальный Enterprise-режим ALL ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">УСЛОВИЕ ПЕРЕКЛЮЧЕНИЯ: if (dbName === 'ALL')</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Активация сквозного каскадного затвора ограничений</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: УРОВЕНЬ ТАБЛИЦ И МАТРИЦЫ СХЕМ (TABLE SCOPE)</div>
      <div style="font-size:0.85rem; color:#94a3b8;">sSelect.innerHTML = 'BCE CXEMЫ (ALL)' ──► tInput.value = 'ALL' (disabled = true)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Синхронный перевод яруса последовательностей</span></td>
  </tr>
  <tr style="background-color:#f1f5f9; color:#334155; text-align:center;">
    <td style="padding:10px; border:1px solid #cbd5e1;">
      <strong>ЭТАП Б: ИБ-ФИКС ДЛЯ СИКВЕНСОВ (SEQUENCE SCOPE)</strong><br>
      <span style="font-size:0.8rem; color:#64748b;">seqSelect.innerHTML = 'BCE CXEMЫ (ALL)' ──► seqInput.value = 'ALL' (disabled = true)</span>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Прерывание дальнейших сетевых вызовов</span></td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛЬНЫЙ RETURN: БЛОКИРОВКА ОТПРАВКИ ТОЧЕЧНЫХ ЗАПРОСОВ СХЕМ В СЕТЬ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы глобального переключения ALL:
* **Защита от несогласованных инжектов в параметры объектов (Strict State Isolation)**: Когда оператор 
  выбирает веерный накат на "Все базы данных", точечный ввод конкретной таблицы или схемы 
  становится синтаксически невалидным на бэкенде. Для предотвращения отправки битых пакетов, 
  контур принудительно затирает поля ввода строк маркерами `value = 'ALL'` и жестко блокирует 
  их через `disabled = true`. Пользователь физически не может отправить 
  несовместимую конфигурацию "Все базы ──► Схема public ──► Таблица my_table".
* **Отказоустойчивый фолбек при сетевых крахах**: Если при запросе конкретных схем удаленная 
  СУБД возвращает ошибку, секция `catch (err)` перехватывает крах и выставляет безопасный 
  фолбек-дефолт: селекторы принудительно наполняются единственной системной схемой `public`. 
  Это страхует веб-панель от полной парализации интерфейса при локальных сбоях связи.

------------------------------------------------------------------------------------------
МОДУЛЬ ВЕЕРНОГО НАКАТА ПРАВ (rights.js)
------------------------------------------------------------------------------------------

Контур обеспечивает перехват отправки формы (submitForm), валидацию ключевых полей периметра СУБД,
атомарную сборку веера целевых баз данных и послойный разбор геометрии уровней (DATABASE / SCHEMA / TABLE / SEQUENCE).

--- Схема послойного разбора уровней геометрии форм ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВХОДНОЙ ТРИГГЕР ЗАПУСКА: submitForm(event, scope)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Проверка заполнения: if (!server || !dbName || !role) ──► Сброс</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: СБОРКА МАССИВА ВЕЕРА ЦЕЛЕВЫХ БАЗ ДАННЫХ ДЛЯ ЦИКЛА</div>
      <div style="font-size:0.85rem; color:#94a3b8;">if (dbName === 'ALL') ──► Извлечение массива из datalist/ОЗУ-кэша иначе [dbName]</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Каскадный разбор параметров по значению scope</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:24%; padding:8px; background-color:#ffffff; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:#1e293b;">
            scope == 'DATABASE'
          </td>
          <td style="width:1%; border:none;"></td>
          <td style="width:24%; padding:8px; background-color:#ffffff; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:#1e293b;">
            scope == 'SCHEMA'
          </td>
          <td style="width:1%; border:none;"></td>
          <td style="width:24%; padding:8px; background-color:#ffffff; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:#1e293b;">
            scope == 'TABLE'
          </td>
          <td style="width:1%; border:none;"></td>
          <td style="width:25%; padding:8px; background-color:#ffffff; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:#1e293b;">
            scope == 'SEQUENCE'
          </td>
        </tr>
        <tr>
          <td style="padding:6px; text-align:left; color:#334155; line-height:1.3; font-size:0.75rem;">
            🔹 Чтение dbAction и dbPrivilege.<br>
            🔹 Наглухо обнуляет tableName.<br>
            🔹 schemaName = 'public'.
          </td>
          <td></td>
          <td style="padding:6px; text-align:left; color:#334155; line-height:1.3; font-size:0.75rem;">
            🔹 Чтение множественного селектора схем.<br>
            🔹 Агрегация привилегий через .join(', ').<br>
            🔹 tableName = ''.
          </td>
          <td></td>
          <td style="padding:6px; text-align:left; color:#334155; line-height:1.3; font-size:0.75rem;">
            🔹 Извлечение tableSchemaTarget и tableNameTarget.<br>
            🔹 Сбор привилегий таблиц через Array.from.
          </td>
          <td></td>
          <td style="padding:6px; text-align:left; color:#334155; line-height:1.3; font-size:0.75rem;">
            🔹 Извлечение seqSchemaTarget и seqNameTarget.<br>
            🔹 Сбор привилегий последовательностей через .join().
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ПЕРЕХОД К АСИНХРОННОМУ ЦИКЛУ ПОЭТАПНОЙ НАКАТКИ НА ВСЕ БАЗЫ КЛАСТЕРА
    </td>
  </tr>
</table>

### 🛡️ Profiling ИБ-защиты подсистемы разбора уровней:
* **Защита от отправки пустых или недогруженных пакетов**: Барьер `if (!server || !dbName || !role)` 
  на строке 212 монументально блокирует трансляцию пакетов в сеть, если оператор не выбрал 
  целевые узлы, защищая API от генерации битых запросов и ошибок типов СУБД.
* **Предотвращение обрыва цикла при веерной обработке 'ALL'**: Сборщик массива на строках 220–232 
  считывает реальные скрытые опции дата-листа. Если СУБД не успела отдать список баз, активируется 
  резервный ИБ-страховочный кэш `window.currentServerDatabasesCache`. Это исключает ситуацию, 
  когда накат прав зависает на середине из-за краха кэша DOM-дерева браузера.

------------------------------------------------------------------------------------------
МОДУЛЬ ВЕЕРНОГО НАКАТА ПРАВ (rights.js)
------------------------------------------------------------------------------------------
Контур обеспечивает запуск асинхронного веерного цикла последовательной обработки баз 
данных по очереди, жестко прерывая выполнение при отказах ИБ-периметра.

--- Схема асинхронного веерного цикла отправки привилегий ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СТАРТ ЦИКЛА: for (const currentDb of targetDbs)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сборка Payload с инжекцией currentDb на каждом шаге</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ОТПРАВКА АТОМАРНОГО ПАКЕТА: secureFetch('/api/manage-privileges/')</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Изоляция сетевой транзакции внутри индивидуального try-catch блока</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Разветвление ИБ-контроля ответа удаленного узла</span></td>
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
            Ответ: response.ok == false / Ошибка
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Инкремент счетчика: successCount++.<br>
            🚀 Безаварийный переход к следующей целевой базе данных кластера СУБД.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Обнаружен отказ СУБД или сетевой крах.<br>
            ⚠️ Вызов аварийного alert() с маскированием трассировок.<br>
            🛑 Жесткий сброс (return): мгновенное прерывание выполнения всего цикла!
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ЦИКЛ СИНХРОНИЗИРОВАН: АВТО-ОБНОВЛЕНИЕ ЖУРНАЛА AUDIT_LOGS
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы асинхронного веера:
* **Жесткое прерывание при компрометации (Fail-Fast Mechanism)**: Инструкция `return` на 
  строках 338 и 343 гарантирует моментальную остановку веерной рассылки прав при первой 
  же ошибке. Если злоумышленник попытается подменить DSN одной из баз данных 
  в веере для проведения атаки, выполнение заблокируется, не позволяя деформировать права на 
  остальных узлах кластера.
* **Принудительное восстановление скрытых ИБ-экранов**: После выполнения всего цикла 
  механизм на строках 357–364 считывает `panel_user_role` и принудительно восстанавливает 
  ИБ-вкладки (`display: block !important`). Это страхует Офицера безопасности от 
  случайного затирания или скрытия его элементов управления другими скриптами веб-панели.

------------------------------------------------------------------------------------------
МОДУЛЬ ВЕЕРНОГО НАКАТА ПРАВ (rights.js)
------------------------------------------------------------------------------------------
Контур обеспечивает безопасное динамическое построение строк поисковых запросов архива 
аудита, постраничный рендеринг таблицы и жесткую синхронизацию под структуру системной таблицы.

--- Схема динамической фильтрации логов архива аудита ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ЗАПУСК ПЕРЕЗАГРУЗКИ ЖУРНАЛА: loadAuditLogs()</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сбор параметров с защитой от NULL: admin_username, target_server, action, timestamp</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: ЭКРАНИРОВАНИЕ И КОМПИЛЯЦИЯ QUERY_STRING</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Использование encodeURIComponent() для всех пользовательских инпутов на строках 398–401</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Считывание и декомпрессия JSON-массива бэкенда</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ecfdf5; border:1px solid #10b981; border-radius:4px; color:#065f46; font-weight:bold;">
            Поле: l.status === 'SUCCESS' / 'success'
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Поле: l.status === 'ERROR' / 'error'
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🟢 Присвоение CSS-стиля: class="status-success".<br>
            💬 Замена колонки описания ошибок на серый плейсхолдер дефолта: "-".
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Присвоение CSS-стиля: class="status-error".<br>
            🚨 Инжект сырого текста ошибки PostgreSQL внутрь безопасного контейнера тега &lt;code&gt;.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      СТРОКА В TBODY СИНХРОНИЗИРОВАНА НА 100% ПОД СТРУКТУРУ ТАБЛИЦЫ AUDIT_LOGS
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы логирования и пагинации:
* **Защита от атак на перезапись URI (HTTP Parameter Pollution)**: Все параметры динамической 
  фильтрации (имя администратора, тип действия, идентификатор сервера) перед сквозной 
  конкатенацией в URL принудительно экранируются встроенным ИБ-методом `encodeURIComponent()` 
  на строках 398–401. Это полностью исключает возможность внедрения спецсимволов (`&`, `=`, `?`) 
  для подмены параметров пагинации или несанкционированного чтения чужих логов аудита.
* **Снайперский фолбек неопределенных значений (Null Safety)**: При разборе лога, 
  для каждого реляционного поля (`admin_username`, `table_name`, `target_server`) предусмотрен 
  жесткий строковый фолбек-затвор `|| '-'`. Это страхует DOM-дерево интерфейса 
  от аварийного вывода значений `undefined` или падения рендеринга страницы при чтении пустых 
  ячеек из СУБД логов панели.


