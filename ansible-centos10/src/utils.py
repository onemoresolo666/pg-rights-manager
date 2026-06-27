import os
import jwt # БИБЛИОТЕКА JWT ДЛЯ АВТОРИЗАЦИИ
import logging
import threading
from datetime import datetime
from fastapi import HTTPException, Depends, Request
from fastapi.security import OAuth2PasswordBearer # ИМПОРТ СХЕМЫ БЕЗОПАСНОСТИ FASTAPI
from pydantic import BaseModel, Field
from cryptography.fernet import Fernet
from psycopg import connect, sql
from psycopg_pool import ConnectionPool

# Настройка логгера для вывода критических предупреждений в journalctl
logger = logging.getLogger("uvicorn.error")

# ЗАГРУЗКА И ВАЛИДАЦИЯ СЕКРЕТОВ ИЗ ОКРУЖЕНИЯ (.env)
MASTER_KEY = os.getenv("MASTER_KEY")
if not MASTER_KEY:
    raise RuntimeError("Критическая ошибка: Переменная MASTER_KEY пустая!")
cipher = Fernet(MASTER_KEY.encode())

# КОНСТАНТЫ КРИПТОГРАФИЧЕСКОЙ ЗАЩИТЫ JWT (СИНХРОНИЗИРОВАНО С MAIN И PANEL_USERS)
JWT_SECRET = "SUPER_SECRET_ENTERPRISE_KEY_2026"
JWT_ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# =========================================================================
# ФУНКЦИЯ ПРОВЕРКИ ТОКЕНОВ СЕССИИ
# =========================================================================
def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Извлекает и валидирует JWT-токен текущей сессии администратора панели.
    Используется внутри utils.py, поэтому префиксы 'utils.' исключены.
    """
    try:
        # Криптографическое декодирование токена секретным ключом
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")

        if username is None:
            logger.warning("[ИБ-АНУМАЛИЯ] !!! КОРРУПЦИЯ ТОКЕНА | Поле 'sub' (имя пользователя) отсутствует в JWT-payload!")
            raise HTTPException(status_code=401, detail="Невалидный токен авторизации")

        # Успешный вызов оставляем без уведомлений, чтобы беречь дисковое пространство
        return username

    except jwt.ExpiredSignatureError as exp_err:
        # Фиксируем естественное или умышленное использование просроченной сессии
        logger.info(f"[ИБ-АУДИТ] Сессия пользователя истекла по таймауту JWT. Доступ отклонен.")
        raise HTTPException(status_code=401, detail="Сессия истекла. Войдите заново.")

    except jwt.InvalidSignatureError as sig_err:
        # КРИТИЧЕСКИЙ ИНЦИДЕНТ: Кто-то пытается подделать секретную подпись MASTER_KEY/SECRET_KEY!
        logger.error(f"[ИБ-АТАКА] !!! КОМПРОМЕТАЦИЯ ПОДПИСИ | Зафиксирована попытка входа с поддельным JWT-токеном! Ошибка: {str(sig_err)}")
        raise HTTPException(status_code=401, detail="Критическая ошибка безопасности. Сессия заблокирована.")

    except jwt.PyJWTError as jwt_err:
        # Любые другие структурные повреждения пакета токена
        logger.warning(f"[ИБ-АУДИТ] !!! ОТКЛОНЕННЫЙ ТОКЕН | Общая ошибка валидации JWT-пакета: {str(jwt_err)}")
        raise HTTPException(status_code=401, detail="Сессия невалидна. Войдите заново.")


# =========================================================================
# КЛАСС ПРОВЕРКИ ИБ-РОЛЕЙ НА СТОРОНЕ БЭКЕНДА
# =========================================================================
class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        """Принимает список ролей, которым разрешен доступ к эндпоинту"""
        self.allowed_roles = allowed_roles

    def __call__(self, token: str = Depends(oauth2_scheme)):
        """Вызывается как зависимость FastAPI для проверки роли внутри JWT"""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_role = payload.get("role")
            username = payload.get("sub")

            if username is None or user_role is None:
                logger.warning(f"[ИБ-АНУМАЛИЯ] !!! ПОВРЕЖДЕНИЕ СТРУКТУРЫ | Токен содержит пустые метаданные. Логин: '{username}', Роль: '{user_role}'")
                raise HTTPException(status_code=401, detail="Невалидная структура токена авторизации")

            # ПРОВЕРКА РОЛЕВОЙ МОДЕЛИ ДОСТУПА
            if user_role not in self.allowed_roles:
                # КРИТИЧНО ДЛЯ ИБ: фиксируем попытку несанкционированного доступа к защищенному эндпоинту
                logger.warning(
                    f"[ИБ-НАРУШЕНИЕ] !!! ОТКАЗ В ДОСТУПЕ | Пользователь '{username}' с ролью [{user_role}] "
                    f"попытался вызвать эндпоинт, требующий права: {self.allowed_roles}"
                )
                raise HTTPException(
                    status_code=403,
                    detail="Доступ запрещен: у вашей роли недостаточно прав для этого действия"
                )

            return username

        except jwt.PyJWTError as jwt_err:
            # Предупреждение о сгоревшей сессии
            logger.info(f"[ИБ-АУДИТ] Ролевой барьер отклонил запрос: сессия истекла или невалидна. Ошибка: {str(jwt_err)}")
            raise HTTPException(status_code=401, detail="Сессия истекла. Войдите заново.")

SERVICE_DB_DSN = (
    f"dbname={os.getenv('SERVICE_DB_NAME')} "
    f"user={os.getenv('SERVICE_DB_USER')} "
    f"password={os.getenv('SERVICE_DB_PASSWORD')} "
    f"host={os.getenv('SERVICE_DB_HOST')} "
    f"port={os.getenv('SERVICE_DB_PORT')}"
)

# Глобальный пул изначально равен None, открывается по требованию или lifespan
db_pool = None

# [ИБ-ЗАЩИТА]: Межпоточный затвор для предотвращения Race Condition в рантайме uvicorn
pool_lock = threading.Lock()

def init_pool():
    global db_pool
    
    # Если пул уже собран в параллельном потоке — мгновенно выходим
    if db_pool is not None:
        return

    # Захватываем потокобезопасный барьер
    with pool_lock:
        # Повторно проверяем состояние переменной (Double-Checked Locking паттерн)
        if db_pool is None:
            logger.info("[ИБ-ИНФРАСТРУКТУРА] Инициирована строгая сборка пула соединений из окружения .env...")
            
            db_name = os.environ.get("SERVICE_DB_NAME")
            db_user = os.environ.get("SERVICE_DB_USER")
            db_pass = os.environ.get("SERVICE_DB_PASSWORD")
            db_host = os.environ.get("SERVICE_DB_HOST", "127.0.0.1")
            db_port = os.environ.get("SERVICE_DB_PORT", "5432")
            
            # Жёсткий заслон: если критические секреты отсутствуют в .env — рубим запуск панели
            if not db_name or not db_user or not db_pass:
                logger.critical("[ИБ-КРАХ] Фатальная ошибка: В файле .env отсутствуют обязательные параметры подключения SERVICE_DB_*!")
                raise ValueError("Критическая ошибка безопасности: Переменные СУБД не инициализированы в .env файле.")
            
            # Собираем чистую строку DSN налету
            env_dsn = f"dbname={db_name} user={db_user} password={db_pass} host={db_host} port={db_port}"
            
            try:
                db_pool = ConnectionPool(
                    conninfo=env_dsn,
                    min_size=2,
                    max_size=10,
                    open=True,
                    # Включаем автоматический контроль внутренней чистоты транзакций в пуле
                    kwargs={"autocommit": True, "connect_timeout": 5}
                )
                logger.info("[ИБ-ИНФРАСТРУКТУРА] Пул СУБД успешно запечатан на 100% из параметров .env.")
            except Exception as pool_err:
                logger.critical(f"[ИБ-КРАХ] Фатальная ошибка инициализации пула: {str(pool_err)}", exc_info=True)
                raise pool_err

def close_pool():
    global db_pool
    
    # Безопасное каскадное закрытие ресурсов при тушении службы systemd
    with pool_lock:
        if db_pool is not None:
            logger.info("[ИБ-ИНФРАСТРУКТУРА] Инициировано плановое закрытие пула соединений...")
            try:
                db_pool.close()
                db_pool = None
                logger.info("[ИБ-ИНФРАСТРУКТУРА] Пул соединений успешно уничтожен. Все сокеты закрыты.")
            except Exception as close_err:
                logger.error(f"[ИБ-КРАХ] Ошибка при деинициализации пула СУБД панели: {str(close_err)}")
                
                
class ServerTestRequest(BaseModel):
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(5432, ge=1, le=65535)
    db_user: str = Field(..., min_length=1, max_length=63)
    dbname: str = Field(..., min_length=1, max_length=63)
    password: str = Field(..., min_length=1)

def get_server_from_db(server_id: str) -> dict:
    """Извлекает и дешифрует конфигурацию подключения к целевому серверу PostgreSQL"""
    query = 'SELECT host, "port", db_user, dbname, encrypted_password FROM registered_servers WHERE server_id = %s AND is_active = true;'
    
    try:
        init_pool()
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (server_id,))
                row = cur.fetchone()
                
                if not row:
                    logger.warning(f"[ИБ-АУДИТ] !!! ОБЪЕКТ НЕ НАЙДЕН | Запрошен реестр для несуществующего или архивного сервера '{server_id}'")
                    raise HTTPException(status_code=404, detail=f"Сервер '{server_id}' не зарегистрирован в системе или деактивирован.")
                
                # Дешифруем сохраненный секретный пароль целевой СУБД
                try:
                    # ИБ-ФИКС: Гарантируем вызов cipher через локальное пространство модуля (или self.cipher)
                    # Если cipher объявлен в глобальной области utils.py, используем имя глобальной переменной
                    global_cipher = globals().get('cipher') or (self.cipher if 'self' in locals() else cipher)
                    decrypted_password = global_cipher.decrypt(row[4].encode()).decode()
                except Exception as crypt_err:
                    # КРИТИЧНО ДЛЯ ИБ: Немедленно фиксируем попытку расшифровать данные сбитым ключом MASTER_KEY
                    logger.critical(f"[ИБ-КРАХ] Фатальный сбой криптографии при чтении секретов сервера '{server_id}': {str(crypt_err)}", exc_info=True)
                    raise HTTPException(status_code=500, detail="Критический сбой подсистемы криптографии ядра панели.")

                try:
                    raw_port = str(row[1]).strip()
                    safe_port = int(raw_port) if raw_port and raw_port.isdigit() else 5432
                except (ValueError, TypeError):
                    safe_port = 5432

                # Возвращаем чистый словарь параметров для psycopg.connect
                return {
                    "host": str(row[0]),
                    "port": safe_port,
                    "user": str(row[2]),
                    "dbname": str(row[3]),
                    "password": str(decrypted_password),
                    "connect_timeout": 5
                }

    except HTTPException:
        raise
    except Exception as e:
        # Логируем любые сетевые затыки или проблемы пула СУБД в текстовый лог ОС с полной трассировкой
        logger.error(f"[ИБ-КРАХ] Не удалось извлечь параметры DSN для сервера '{server_id}': {str(e)}", exc_info=True)
        # Маскируем сырую ошибку PostgreSQL для защиты архитектуры от внешних утечек данных
        raise HTTPException(status_code=500, detail="Ошибка базы данных при извлечении параметров подключения к целевому серверу.")

def log_operation(
    target_server: str,
    username: str,
    table_name: str,
    action: str,
    privilege: str,
    status: str,
    error_message: str = None,
    admin_username: str = "Система"
):
    """
    Записывает лог выполненной операции в системную таблицу audit_logs панели СУБД
    """
    # ИБ-ФИКС: В блоке INSERT ровно 9 целевых колонок.
    # В блоке VALUES указано ровно 8 плейсхолдеров %s и 1 встроенная функция localtimestamp.
    # PostgreSQL ожидает на вход кортеж строго из 8 переменных, которые мы и передаем ниже.
    query = """
        INSERT INTO audit_logs (
            target_server, username, table_name, action,
            privilege, status, error_message, timestamp, admin_username
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, localtimestamp, %s);
    """

    safe_table_name = table_name if table_name else "ALL"

    try:
        init_pool()
        with db_pool.connection() as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(
                    query,
                    (
                        target_server, 
                        username, 
                        safe_table_name, 
                        action,
                        privilege, 
                        status, 
                        error_message, 
                        admin_username
                    )
                )

    except Exception as e:
        # КРИТИЧНО ДЛЯ ИБ: Заменяем слепой принт на жесткий логгер с выводом полного traceback аварии
        logger.error(f"[КРИТИЧЕСКАЯ ОШИБКА АУДИТА]: Не удалось зафиксировать ИБ-лог операции в СУБД панели: {str(e)}", exc_info=True)
        # ВАЖНО: Мы НЕ пробрасываем raise наружу через веб-сервер, чтобы сбой записи лога
        # не ломал пользователю основное действие (создание или удаление юзера в СУБД)
        pass
