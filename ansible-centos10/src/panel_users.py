import re
import utils
import psycopg
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request 
from pydantic import BaseModel, Field, field_validator
from bcrypt import hashpw, gensalt
from passlib.context import CryptContext
from typing import List, Optional


# Подключаем логгер к стандартному потоку uvicorn, как и в main.py
logger = logging.getLogger("uvicorn.error")

# Инициализируем 12-раундный контекст криптографического хеширования Bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Тянем функцию проверки токенов сессий строго из утилит без круговых импортов
from utils import get_current_user, RoleChecker

router = APIRouter(tags=["panel-users"])

# Схемы строгой валидации входных данных Pydantic v2 (Расширены под веерные лимиты)
class PanelUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=63, pattern="^[a-zA-Z0-9_]+$")
    password: str
    role: str = "admin"
    allowed_servers: List[str]      # Пул разрешённых серверов СУБД из инпута
    allowed_target_roles: List[str]  # Пул лимитов ролей для модального окна pg_*

    @field_validator("password")
    @classmethod
    def validate_strong_password(cls, v: str) -> str:
        if len(v) < 64:
            raise ValueError("должен быть не менее 64 символов в длину")
        if not re.search(r"[a-z]", v):
            raise ValueError("должен содержать минимум одну строчную букву")
        if not re.search(r"[A-Z]", v):
            raise ValueError("должен содержать минимум одну заглавную букву")
        if not re.search(r"\d", v):
            raise ValueError("должен содержать минимум одну цифру")
        if not re.search(r"[@$!%*?&_\-!#.]", v):
            raise ValueError("должен содержать минимум один спецсимвол (@$!%*?&_-!#.)")
        return v

# =========================================================================
# СХЕМА СТРОГО ПОД 3 ТЕКСТОВЫХ ПОЛЯ
# =========================================================================
class UserLimitsUpdateRequest(BaseModel):
    username: str
    allowed_servers: List[str]
    allowed_target_roles: List[str]


class PasswordUpdateRequest(BaseModel):
    username: str
    new_password: str

class StatusUpdateRequest(BaseModel):
    username: str
    is_active: bool


# =========================================================================
# # 1. НАСТРОЙКА АККАУНТОВ ПАНЕЛИ И МАТРИЦЫ ЛИМИТОВ
# =========================================================================
@router.post("/api/panel-users")
@router.post("/api/panel-users/")
@router.post("/api/admin/configure-panel-manager")
def register_new_panel_user(
    req: PanelUserCreateRequest,
    current_user: str = Depends(RoleChecker(["admin"]))
):
    # ИБ-ЛОГ: Фиксируем старт критической операции конфигурации учетных записей
    logger.info(f"[ИБ-АУДИТ] >>> ЗАПРОС НАСТРОЙКИ АККАУНТА | Администратор: '{current_user}' | Целевой пользователь: '{req.username}' | Назначаемая роль: '{req.role}'")

    from bcrypt import hashpw, gensalt

    if utils.db_pool is None:
        utils.init_pool()

    try:
        with utils.db_pool.connection() as conn:
            # Отключаем автокоммит для обеспечения ACID-транзакции наката лимитов
            conn.autocommit = False

            with conn.cursor() as cur:
                
                # -------------------------------------------------------------------------
                # ИБ-ЗАЩИТА: Локальный перехват ошибок СУБД для предотвращения дедлоков рантайма
                # -------------------------------------------------------------------------
                try:
                    # А. Проверяем существование пользователя
                    cur.execute("SELECT id, role FROM panel_users WHERE username = %s;", (req.username,))
                    user_row = cur.fetchone()

                    if not user_row:
                        # Сценарий 1: Создание НОВОГО менеджера безопасности
                        logger.info(f"[ИБ-АУДИТ] -> Пользователь '{req.username}' не найден. Начинаем создание новой учетной записи...")
                        hashed_password = hashpw(req.password.encode(), gensalt()).decode()

                        cur.execute(
                            "INSERT INTO panel_users (username, password_hash, is_active, role) VALUES (%s, %s, TRUE, %s) RETURNING id;",
                            (req.username, hashed_password, req.role)
                        )
                        db_user_id = cur.fetchone()[0]
                        operation_type = "CREATE_ADMIN"
                        logger.info(f"[ИБ-АУДИТ] -> Учетная запись '{req.username}' успешно создана. Базовый ID: {db_user_id}")
                    else:
                        # Сценарий 2: Модификация СУЩЕСТВУЮЩЕГО менеджера
                        db_user_id = user_row[0]
                        logger.info(f"[ИБ-АУДИТ] -> Пользователь '{req.username}' существует (ID: {db_user_id}). Обновляем глобальную роль на '{req.role}'...")

                        cur.execute("UPDATE panel_users SET role = %s WHERE id = %s;", (req.role, db_user_id))

                        # ИБ-ФИКС: Исправляем баг длины. Если пароль передан и он не пустой (длина от 4 символов) — обновляем его
                        if req.password and len(req.password) >= 4:
                            logger.info(f"[ИБ-АУДИТ] -> Зафиксирован запрос сброса пароля для '{req.username}'. Перехэшируем...")
                            hashed_password = hashpw(req.password.encode(), gensalt()).decode()
                            cur.execute("UPDATE panel_users SET password_hash = %s WHERE id = %s;", (hashed_password, db_user_id))

                        operation_type = "UPDATE_ADMIN_LIMITS"

                    # Б. УЛЬТИМАТИВНЫЙ ИБ-ФИКС ОШИБКИ 500: Выжигаем старые лимиты строго по user_id
                    cur.execute("DELETE FROM panel_user_server_access WHERE user_id = %s;", (db_user_id,))
                    cur.execute("DELETE FROM panel_user_role_limits WHERE user_id = %s;", (db_user_id,))

                    # В. ВЕЕРНЫЙ ИБ-ИНЖЕКТ ПУЛА СЕРВЕРОВ СУБД по ключу user_id
                    if req.allowed_servers:
                        logger.info(f"[ИБ-АУДИТ] -> Привязываем доступ к серверам СУБД для '{req.username}'. Количество узлов: {len(req.allowed_servers)}")
                        for server_id in req.allowed_servers:
                            cur.execute(
                                "INSERT INTO panel_user_server_access (user_id, allowed_server_id, allowed_database) VALUES (%s, %s, 'ALL');",
                                (db_user_id, server_id)
                            )

                    # Г. ВЕЕРНЫЙ ИБ-ИНЖЕКТ ПУЛА ЛИМИТОВ РОЛЕЙ по ключу user_id
                    if req.allowed_target_roles:
                        logger.info(f"[ИБ-АУДИТ] -> Накатываем матрицу разрешенных ролей для '{req.username}'. Количество ролей: {len(req.allowed_target_roles)}")
                        for role_item in req.allowed_target_roles:
                            cur.execute(
                                "INSERT INTO panel_user_role_limits (user_id, allowed_target_role) VALUES (%s, %s);",
                                (db_user_id, role_item)
                            )

                    # ACID-коммит трансляции пулов в базу данных панели
                    conn.commit()

                except Exception as sql_err:
                    # При любом сбое внутри транзакции принудительно делаем откат метаданных
                    conn.rollback()
                    logger.error(f"[ИБ-ОТКАЗ] База данных панели отклонила транзакцию лимитов для '{req.username}': {str(sql_err)}")
                    raise HTTPException(status_code=422, detail=f"Ошибка СУБД панели при фиксации матрицы прав: {str(sql_err)}")

        # Ваша штатная запись во внутреннюю таблицу СУБД логов панели при УСПЕХЕ
        utils.log_operation("PANEL_MANAGER", str(current_user), f"panel_users.{req.username}", operation_type, "ACCESS", "success")

        # ИБ-ЛОГ: Подтверждаем полный успех и фиксацию изменений в системный лог
        logger.info(f"[ИБ-АУДИТ] <<< МАТРИЦА ПРАВ УСПЕШНО ИЗМЕНЕНА | Пользователь '{req.username}' полностью сконфигурирован администратором '{current_user}'. Операция: {operation_type}")
        return {"status": "success", "message": f"Матрица лимитов по общему ID для '{req.username}' успешно запечатана в СУБД!"}

    except HTTPException:
        raise
    except Exception as e:
        # КРИТИЧНО ДЛЯ ИБ: Записываем крах самого пула соединений в логгер ОС с подробным traceback
        logger.error(f"[ИБ-КРАХ] Фатальный сбой настройки аккаунта '{req.username}' администратором '{current_user}': {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера. Не удалось обновить матрицу прав пользователей панели.")




# =========================================================================
# # 2. РЕЕСТР АДМИНИСТРАТОРОВ ПАНЕЛИ
# =========================================================================
@router.get("/api/admin/panel-users-list")
@router.get("/api/admin/panel-users-list/")
def get_panel_users_list(
    current_user: str = Depends(RoleChecker(["admin", "Security_Manager", "auditor"]))
):
    # ИБ-ЛОГ: Фиксируем факт выгрузки чувствительной ИБ-матрицы лимитов администраторов
    logger.info(f"[ИБ-АУДИТ] >>> Запрос реестра администраторов панели. Оператор: '{current_user}'")

    if utils.db_pool is None:
        utils.init_pool()

    try:
        with utils.db_pool.connection() as conn:
            with conn.cursor() as cur:
                
                # -------------------------------------------------------------------------
                # ИБ-ЗАЩИТА: Локальный перехват ошибок СУБД для предотвращения дедлоков
                # -------------------------------------------------------------------------
                try:
                    # Наш суверенный оптимизированный запрос со вложенными subqueries (фикс Декартова умножения)
                    cur.execute("""
                        SELECT u.id, u.username, u.role, u.is_active,
                            (SELECT string_agg(DISTINCT allowed_server_id, ',') 
                             FROM panel_user_server_access 
                             WHERE user_id = u.id) as allowed_servers,
                            (SELECT string_agg(DISTINCT allowed_target_role, ',') 
                             FROM panel_user_role_limits 
                             WHERE user_id = u.id) as allowed_target_roles
                        FROM panel_users u
                        GROUP BY u.id, u.username, u.role, u.is_active;
                    """)
                    rows = cur.fetchall()
                except Exception as sql_err:
                    logger.error(f"[ИБ-ОТКАЗ] База данных панели отклонила выгрузку реестра админов: {str(sql_err)}")
                    raise HTTPException(status_code=422, detail="СУБД панели отклонила запрос чтения матрицы лимитов.")

                users_list = []
                for row in rows:
                    users_list.append({
                        "id": row[0],
                        "username": row[1],
                        "role": row[2],
                        "is_active": row[3],
                        "allowed_servers": row[4] if row[4] else "",
                        "allowed_target_roles": row[5] if row[5] else ""
                    })

                # ИБ-ЛОГ: Подтверждаем успешное выполнение операции
                logger.info(f"[ИБ-АУДИТ] <<< Реестр администраторов панели успешно выгружен для '{current_user}'. Передано записей: {len(users_list)}")
                return {"status": "success", "users": users_list}

    except HTTPException:
        raise
    except Exception as e:
        # КРИТИЧНО ДЛЯ ИБ: Логируем детальную ошибку краха СУБД с полной трассировкой (Traceback) в логгер
        logger.error(f"[ИБ-КРАХ] Фатальная ошибка чтения реестра администраторов для пользователя '{current_user}': {str(e)}", exc_info=True)
        
        raise HTTPException(
            status_code=500, 
            detail="Ошибка выполнения операции. Не удалось извлечь данные из реестра администраторов СУБД."
        )


# =========================================================================
# # 3. ИНЛАЙН СМЕНА ПАРОЛЯ ИЗ СТРОКИ ТАБЛИЦЫ МОНИТОРНИГА
# =========================================================================
@router.put("/api/panel-users/change-password")
@router.put("/api/panel-users/change-password/")
def change_panel_user_password(
    req: PasswordUpdateRequest,
    current_user: str = Depends(RoleChecker(["admin"]))
):
    # ИБ-ЛОГ: Фиксируем запрос на смену пароля учетных данных панели
    logger.info(f"[ИБ-АУДИТ] >>> ЗАПРОС СМЕНЫ ПАРОЛЯ | Администратор: '{current_user}' -> Целевой аккаунт: '{req.username}'")

    try:
        # Прогоняем новый пароль через наш сильный ИБ-валидатор силы паролей
        PanelUserCreateRequest.validate_strong_password(req.new_password)
    except ValueError as val_err:
        logger.warning(f"[ИБ-АУДИТ] !!! СБОЙ ВАЛИДАЦИИ | Передан слабый пароль для '{req.username}' администратором '{current_user}'. Ошибка: {str(val_err)}")
        raise HTTPException(status_code=422, detail=str(val_err))

    if utils.db_pool is None:
        utils.init_pool()

    try:
        with utils.db_pool.connection() as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                
                # -------------------------------------------------------------------------
                # ИБ-ЗАЩИТА: Локальный перехват ошибок СУБД для предотвращения дедлоков
                # -------------------------------------------------------------------------
                try:
                    from bcrypt import hashpw, gensalt
                    # Генерируем безопасный bcrypt-хэш пароля
                    hashed_password = hashpw(req.new_password.encode(), gensalt()).decode()

                    # Обновляем секрет в главной ИБ-таблице панели
                    cur.execute("UPDATE panel_users SET password_hash = %s WHERE username = %s;", (hashed_password, req.username))
                    affected_rows = cur.rowcount
                except Exception as sql_err:
                    logger.error(f"[ИБ-ОТКАЗ] СУБД панели отклонила смену пароля для '{req.username}': {str(sql_err)}")
                    raise HTTPException(status_code=422, detail=f"Ошибка СУБД панели при обновлении секрета: {str(sql_err)}")

                if affected_rows == 0:
                    logger.warning(f"[ИБ-АУДИТ] !!! ОБЪЕКТ НЕ НАЙДЕН | Попытка смены пароля несуществующему пользователю '{req.username}' администратором '{current_user}'")
                    raise HTTPException(status_code=404, detail="Администратор с таким именем не найден в системе.")

                # ИБ-ФИКС: Передаем в log_operation ровно 8 параметров в соответствии с новой структурой utils.log_operation
                utils.log_operation(
                    target_server="PANEL_MANAGER",
                    username=req.username,
                    table_name=f"panel_users.{req.username}",
                    action="UPDATE_PASSWORD",
                    privilege="ACCESS",
                    status="success",
                    error_message=None,
                    admin_username=str(current_user)
                )

                # ИБ-ЛОГ: Подтверждаем полный успех и фиксацию изменений в системный лог ОС РЕД ОС
                logger.info(f"[ИБ-АУДИТ] <<< ПАРОЛЬ УСПЕШНО ОБНОВЛЕН | Секретные данные пользователя '{req.username}' перезаписаны администратором '{current_user}'.")
                return {"status": "success", "message": f"Пароль для администратора '{req.username}' успешно обновлен!"}

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        # Резервная запись об ошибке в аудит-лог с правильным числом параметров
        try:
            utils.log_operation(
                target_server="PANEL_MANAGER",
                username=req.username,
                table_name=f"panel_users.{req.username}",
                action="UPDATE_PASSWORD",
                privilege="ACCESS",
                status="error",
                error_message=err_msg,
                admin_username=str(current_user)
            )
        except Exception:
            pass

        # КРИТИЧНО ДЛЯ ИБ: Логируем детальную ошибку краха СУБД с полной трассировкой (Traceback) в логгер ОС
        logger.error(f"[ИБ-КРАХ] Фатальный сбой обновления пароля для '{req.username}' администратором '{current_user}': {err_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка выполнения операции. Не удалось обновить пароль в базе данных панели.")


# =========================================================================
# # 4. ИНЛАЙН БЛОКИРОВКА / СНЯТИЕ БАНА МЕНЕДЖЕРОВ ПАНЕЛИ
# =========================================================================
@router.put("/api/panel-users/toggle-status")
@router.put("/api/panel-users/toggle-status/")
@router.post("/api/admin/toggle-manager-status")
async def toggle_panel_user_status(
    request: Request,
    current_user: str = Depends(RoleChecker(["admin"]))
):
    # Логируем сам факт обращения к эндпоинту управления жизненным циклом
    logger.info(f"[ИБ-АУДИТ] >>> ЗАПРОС ИЗМЕНЕНИЯ СТАТУСА АККАУНТА | Администратор: '{current_user}'")

    if utils.db_pool is None:
        utils.init_pool()

    username = None
    is_active = None

    try:
        # Асинхронно вычитываем сырой JSON-пакет, отправленный фронтендом
        payload = await request.json()
        if payload:
            username = payload.get("username")
            # Всеядный ИБ-парсер: подхватываем и булево is_active, и строковый статус
            if "is_active" in payload:
                is_active = bool(payload.get("is_active"))
            elif "status" in payload:
                is_active = True if payload.get("status") == "ACTIVE" else False
    except Exception:
        logger.warning(f"[ИБ-АУДИТ] !!! НЕКОРРЕКТНЫЙ ЗАПРОС | Передан поврежденный JSON-пакет от '{current_user}'")
        raise HTTPException(status_code=400, detail="Передан некорректный или пустой JSON-пакет привилегий!")

    # ЖЕСТКАЯ ИБ-ВАЛИДАЦИЯ ПАРАМЕТРОВ НА УРОВНЕ ЯДРА БЭКЕНДА
    if not username:
        raise HTTPException(status_code=400, detail="Не передан логин администратора для смены статуса!")

    if is_active is None:
        raise HTTPException(status_code=400, detail="Не передано новое целевое состояние активности (is_active)!")

    # КРИТИЧНО ДЛЯ ИБ: Логируем попытку заблокировать корневого супера
    if username == "admin":
        logger.error(f"[ИБ-АНУМАЛИЯ] !!! ЗАПРЕЩЕННОЕ ДЕЙСТВИЕ | Администратор '{current_user}' попытался изменить статус главного системного администратора 'admin'!")
        raise HTTPException(status_code=400, detail="Критическая защита: Запрещено блокировать главного системного администратора 'admin'!")

    action_text = "разблокирован" if is_active else "заблокирован"
    action_log = "UNLOCK_ADMIN" if is_active else "LOCK_ADMIN"

    logger.info(f"[ИБ-АУДИТ] -> Целевой аккаунт: '{username}' | Новое состояние: {action_text.upper()}")

    try:
        with utils.db_pool.connection() as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                
                # -------------------------------------------------------------------------
                # ИБ-ЗАЩИТА: Локальный перехват ошибок СУБД для предотвращения дедлоков
                # -------------------------------------------------------------------------
                try:
                    # Намертво запечатываем новое состояние активности в СУБД панели
                    cur.execute("UPDATE panel_users SET is_active = %s WHERE username = %s;", (is_active, username))
                    affected_rows = cur.rowcount
                except Exception as sql_err:
                    logger.error(f"[ИБ-ОТКАЗ] СУБД панели отклонила переключение статуса для '{username}': {str(sql_err)}")
                    raise HTTPException(status_code=422, detail=f"Ошибка СУБД панели при обновлении состояния: {str(sql_err)}")

                if affected_rows == 0:
                    logger.warning(f"[ИБ-АУДИТ] !!! ОБЪЕКТ НЕ НАЙДЕН | Попытка смены статуса несуществующему пользователю '{username}' от '{current_user}'")
                    raise HTTPException(status_code=404, detail="Указанный администратор панели не найден в реестре СУБД!")

                # ИБ-ФИКС: Передаем в log_operation ровно 8 параметров в соответствии с нашей структурой
                utils.log_operation(
                    target_server="PANEL_MANAGER",
                    username=username,
                    table_name=f"panel_users.{username}",
                    action=action_log,
                    privilege="ACCESS",
                    status="success",
                    error_message=None,
                    admin_username=str(current_user)
                )

                # ИБ-ЛОГ: Подтверждаем полный успех и фиксацию изменений в системный лог ОС
                logger.info(f"[ИБ-АУДИТ] <<< СТАТУС УСПЕШНО ИЗМЕНЕН | Пользователь '{username}' успешно {action_text} администратором '{current_user}'.")
                return {"status": "success", "message": f"Администратор {username} успешно {action_text}!"}

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        try:
            utils.log_operation(
                target_server="PANEL_MANAGER",
                username=username,
                table_name=f"panel_users.{username}",
                action=action_log,
                privilege="ACCESS",
                status="error",
                error_message=err_msg,
                admin_username=str(current_user)
            )
        except Exception:
            pass

        # КРИТИЧНО ДЛЯ ИБ: Логируем детальную ошибку краха СУБД с полной трассировкой (Traceback) в логгер ОС
        logger.error(f"[ИБ-КРАХ] Фатальный сбой изменения статуса для '{username}' администратором '{current_user}': {err_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка выполнения операции. Не удалось изменить статус пользователя в базе данных панели.")

# =========================================================================
# # 5. БЕЗВОЗВРАТНОЕ ФИЗИЧЕСКОЕ УНИЧТОЖЕНИЕ АККАУНТА
# =========================================================================
@router.delete("/api/panel-users/{user_id}")
@router.delete("/api/panel-users/{user_id}/")
async def delete_panel_user(
    user_id: int,
    current_user: str = Depends(RoleChecker(["admin"]))
):
    # ИБ-ЛОГ: Фиксируем запрос на безвозвратное уничтожение аккаунта менеджера
    logger.info(f"[ИБ-АУДИТ] >>> ЗАПРОС УДАЛЕНИЯ ПОЛЬЗОВАТЕЛЯ | Администратор: '{current_user}' | Целевой ID: {user_id}")

    if utils.db_pool is None:
        utils.init_pool()

    user_name_str = ""

    try:
        with utils.db_pool.connection() as conn:
            # Отключаем автокоммит для обеспечения строгой транзакционности каскадного удаления
            conn.autocommit = False

            with conn.cursor() as cur:
                
                # -------------------------------------------------------------------------
                # ИБ-ЗАЩИТА: Локальный перехват ошибок СУБД для предотвращения дедлоков
                # -------------------------------------------------------------------------
                try:
                    # # 1. СЧИТЫВАЕМ ИМЯ ПОЛЬЗОВАТЕЛЯ ДО ТОГО, КАК ОНО БУДЕТ СТЕРТО
                    cur.execute("SELECT username FROM panel_users WHERE id = %s;", (user_id,))
                    user_res = cur.fetchone()

                    # БЕЗОПАСНАЯ ПРОВЕРКА НА СУЩЕСТВОВАНИЕ ЗАПИСИ
                    if not user_res:
                        logger.warning(f"[ИБ-АУДИТ] !!! ОБЪЕКТ НЕ НАЙДЕН | Попытка удаления несуществующего ID {user_id} администратором '{current_user}'")
                        raise HTTPException(status_code=404, detail=f"Операция отклонена: Администратор с ID {user_id} не найден в реестре СУБД!")

                    # Извлекаем чистую строку имени из кортежа базы данных
                    user_name_str = str(user_res[0]).get("username", "").strip() if isinstance(user_res[0], dict) else str(user_res[0]).strip()
                    logger.info(f"[ИБ-АУДИТ] -> Целевой ID {user_id} сопоставлен с логином: '{user_name_str}'")

                    # # 2. КРИТИЧЕСКАЯ ИБ-ЗАЩИТА СИСТЕМЫ ОТ САМОУНИЧТОЖЕНИЯ
                    if user_name_str == "admin":
                        logger.error(f"[ИБ-АНУМАЛИЯ] !!! КРИТИЧЕСКИЙ ИНЦИДЕНТ | Администратор '{current_user}' попытался СТЕРЕТЬ корневого супера 'admin'!")
                        raise HTTPException(status_code=400, detail="Критическая защита: категорически запрещено удалять главного системного администратора 'admin'!")

                    # # 3. УЛЬТИМАТИВНЫЙ ИБ-ВЫПРЯМИТЕЛЬ: Удаляем запись
                    # (Благодаря ON DELETE CASCADE в вашей схеме СУБД, лимиты из таблиц доступа выжгутся автоматически)
                    cur.execute("DELETE FROM panel_users WHERE id = %s;", (user_id,))
                    
                    # Фиксируем изменения в кластере
                    conn.commit()

                except Exception as sql_err:
                    conn.rollback()
                    logger.error(f"[ИБ-ОТКАЗ] СУБД панели отклонила каскадное удаление ID {user_id}: {str(sql_err)}")
                    raise HTTPException(status_code=422, detail=f"Ошибка СУБД панели при выжигании учетной записи: {str(sql_err)}")

                # # 4. ЭТАЛОННЫЙ ЛОГ ИЗ 8 АРГУМЕНТОВ во внутреннюю таблицу СУБД панели (ИБ-ФИКС КОЛИЧЕСТВА ПАРАМЕТРОВ)
                utils.log_operation(
                    target_server="PANEL_MANAGER",
                    username=user_name_str,
                    table_name=f"panel_users.{user_name_str}",
                    action="DELETE_ADMIN",
                    privilege="ACCESS",
                    status="success",
                    error_message=f"Выжжены все лимиты для ID {user_id} (Логин: {user_name_str})",
                    admin_username=str(current_user)
                )

                # ИБ-ЛОГ: Полный успех операции отправляется в системный журнал ОС РЕД ОС
                logger.info(f"[ИБ-АУДИТ] <<< АККАУНТ УСПЕШНО ВЫЖЖЕН | Пользователь '{user_name_str}' (ID: {user_id}) и все его лимиты стерты администратором '{current_user}'.")
                return {"status": "success", "message": f"Пользователь '{user_name_str}' и все его лимиты ИБ успешно выжжены из кластера!"}

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        try:
            utils.log_operation(
                target_server="PANEL_MANAGER",
                username=user_name_str or f"ID_{user_id}",
                table_name=f"panel_users.{user_id}",
                action="DELETE_ADMIN",
                privilege="ACCESS",
                status="error",
                error_message=err_msg,
                admin_username=str(current_user)
            )
        except Exception:
            pass

        # КРИТИЧНО ДЛЯ ИБ: Записываем крах транзакции удаления в логгер ОС с подробным traceback
        logger.error(f"[ИБ-КРАХ] Фатальный сбой каскадного удаления ID {user_id} администратором '{current_user}': {err_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка БД панели при каскадном удалении. Не удалось стереть учетную запись.")


# =========================================================================
# # 6. ИНЛАЙН ОБНОВЛЕНИЕ МАТРИЦЫ ОГРАНИЧЕНИЙ МЕНЕДЖЕРА
# =========================================================================
@router.post("/api/admin/update-user-limits")
@router.post("/api/admin/update-user-limits/")
def update_user_limits(
    req: UserLimitsUpdateRequest,
    current_user: str = Depends(RoleChecker(["admin"]))
):
    # ИБ-ЛОГ: Фиксируем запрос на модификацию матрицы ограничений менеджера безопасности
    logger.info(f"[ИБ-АУДИТ] >>> ЗАПРОС ИЗМЕНЕНИЯ ЛИМИТОВ | Администратор: '{current_user}' | Целевой аккаунт: '{req.username}'")

    if utils.db_pool is None:
        utils.init_pool()

    try:
        with utils.db_pool.connection() as conn:
            # Обеспечиваем строгую атомарность ACID-транзакции
            conn.autocommit = False

            with conn.cursor() as cur:
                
                # -------------------------------------------------------------------------
                # ИБ-ЗАЩИТА: Локальный перехват ошибок СУБД для предотвращения дедлоков
                # -------------------------------------------------------------------------
                try:
                    # А. [РЕЛИЗНЫЙ ПЕРЕХВАТ ОБЩЕГО КЛЮЧА]: Извлекаем числовой user_id из СУБД по логину
                    cur.execute("SELECT id FROM panel_users WHERE username = %s;", (req.username,))
                    user_res = cur.fetchone()

                    if not user_res:
                        logger.warning(f"[ИБ-АУДИТ] !!! ОБЪЕКТ НЕ НАЙДЕН | Попытка изменить лимиты несуществующему пользователю '{req.username}' администратором '{current_user}'")
                        raise HTTPException(status_code=404, detail=f"Пользователь '{req.username}' не найден в СУБД панели!")

                    db_user_id = user_res if isinstance(user_res, dict) else user_res[0]
                    logger.info(f"[ИБ-АУДИТ] -> Логин '{req.username}' сопоставлен со священным реляционным ID: {db_user_id}")

                    # Б. [УЛЬТИМАТИВНЫЙ ИБ-ФИКС ОШИБКИ 500]: Выжигаем старые лимиты строго по общему ключу user_id
                    cur.execute("DELETE FROM panel_user_server_access WHERE user_id = %s;", (db_user_id,))
                    cur.execute("DELETE FROM panel_user_role_limits WHERE user_id = %s;", (db_user_id,))

                    # В. ВЕЕРНЫЙ ИБ-ИНЖЕКТ ПУЛА СЕРВЕРОВ СУБД по ключу user_id
                    if req.allowed_servers:
                        logger.info(f"[ИБ-АУДИТ] -> Обновление доступных серверов СУБД для '{req.username}'. Количество: {len(req.allowed_servers)}")
                        for server_id in req.allowed_servers:
                            cur.execute(
                                "INSERT INTO panel_user_server_access (user_id, allowed_server_id, allowed_database) VALUES (%s, %s, 'ALL');",
                                (db_user_id, server_id)
                            )

                    # Г. ВЕЕРНЫЙ ИБ-ИНЖЕКТ ПУЛА ЛИМИТОВ РОЛЕЙ по ключу user_id
                    if req.allowed_target_roles:
                        logger.info(f"[ИБ-АУДИТ] -> Накатываем обновленную матрицу разрешенных ролей для '{req.username}'. Количество: {len(req.allowed_target_roles)}")
                        for role_item in req.allowed_target_roles:
                            cur.execute(
                                "INSERT INTO panel_user_role_limits (user_id, allowed_target_role) VALUES (%s, %s);",
                                (db_user_id, role_item)
                            )

                    # Атомарно запечатываем транзакцию в СУБД кластера периметра
                    conn.commit()

                except Exception as sql_err:
                    conn.rollback()
                    logger.error(f"[ИБ-ОТКАЗ] СУБД панели отклонила обновление матрицы лимитов для '{req.username}': {str(sql_err)}")
                    raise HTTPException(status_code=422, detail=f"Ошибка СУБД панели при фиксации матрицы ограничений: {str(sql_err)}")

                # ИБ-ФИКС: Передаем в log_operation ровно 8 параметров в соответствии с новой структурой
                utils.log_operation(
                    target_server="PANEL_MANAGER",
                    username=req.username,
                    table_name=f"panel_users.{req.username}",
                    action="UPDATE_ADMIN_LIMITS",
                    privilege="ACCESS",
                    status="success",
                    error_message=f"Обновлена ИБ-матрица для {req.username}",
                    admin_username=str(current_user)
                )

                # ИБ-ЛОГ: Подтверждаем полный успех и фиксацию изменений в системный лог ОС
                logger.info(f"[ИБ-АУДИТ] <<< МАТРИЦА ЛИМИТОВ ОБНОВЛЕННА | Ограничения пользователя '{req.username}' успешно перезаписаны администратором '{current_user}'.")
                return {"status": "success", "message": f"ИБ-матрица лимитов для '{req.username}' успешно обновлена!"}

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        try:
            utils.log_operation(
                target_server="PANEL_MANAGER",
                username=req.username,
                table_name=f"panel_users.{req.username}",
                action="UPDATE_ADMIN_LIMITS",
                privilege="ACCESS",
                status="error",
                error_message=err_msg,
                admin_username=str(current_user)
            )
        except Exception:
            pass

        # КРИТИЧНО ДЛЯ ИБ: Записываем крах транзакции перевыдачи лимитов в логгер ОС с подробным traceback
        logger.error(f"[ИБ-КРАХ] Фатальный сбой обновления лимитов для '{req.username}' администратором '{current_user}': {err_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка ИБ-контура при обновлении лимитов. Не удалось зафиксировать изменения.")

