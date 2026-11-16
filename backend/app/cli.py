import argparse
from datetime import datetime, timezone
from getpass import getpass
from uuid import uuid4

from app.core.security import hash_password
from app.infrastructure.neo4j.driver import close_driver, ensure_schema, run_write, verify_connectivity
from app.infrastructure.neo4j.repositories.user_repository import create_user, find_user_by_identity



def create_admin(email: str, name: str) -> None:
    normalized_email = email.strip().lower()
    normalized_name = name.strip()
    if "@" not in normalized_email or not normalized_name:
        raise ValueError("A valid email address and non-empty name are required.")
    if find_user_by_identity(normalized_email):
        raise ValueError("A user with this email already exists.")
    password = getpass("Admin password (min 8 characters, uppercase and number required): ")
    if len(password) < 8 or not any(character.isupper() for character in password) or not any(character.isdigit() for character in password):
        raise ValueError("Password must contain at least 8 characters, an uppercase letter, and a number.")
    create_user(
        {
            "id": f"usr_{uuid4().hex}",
            "email": normalized_email,
            "name": normalized_name,
            "role": "admin",
            "passwordHash": hash_password(password),
            "passwordResetRequired": False,
            "authVersion": 0,
            "active": True,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
    )
    print(f"Created administrator account for {normalized_email}.")


def seed_demo() -> None:
    now = datetime.now(timezone.utc).isoformat()
    run_write(
        """
        MERGE (course1:Course {id: 'CO3093'})
        SET course1.code = 'CO3093',
            course1.title = 'Mạng máy tính',
            course1.description = 'Kiến trúc mạng, giao thức TCP/IP, định tuyến và an toàn mạng.',
            course1.faculty = 'Khoa Khoa học Máy tính',
            course1.semester = 'HK261',
            course1.year = 2026,
            course1.credits = 3,
            course1.theme = 'blue',
            course1.published = true,
            course1.createdAt = coalesce(course1.createdAt, $now)

        MERGE (course2:Course {id: 'CO3001'})
        SET course2.code = 'CO3001',
            course2.title = 'Công nghệ Phần mềm',
            course2.description = 'Quy trình phát triển phần mềm, phân tích yêu cầu, kiến trúc và kiểm thử.',
            course2.faculty = 'Khoa Khoa học Máy tính',
            course2.semester = 'HK261',
            course2.year = 2026,
            course2.credits = 3,
            course2.theme = 'green',
            course2.published = true,
            course2.createdAt = coalesce(course2.createdAt, $now)

        MERGE (course3:Course {id: 'CO2003'})
        SET course3.code = 'CO2003',
            course3.title = 'Cấu trúc dữ liệu và giải thuật',
            course3.description = 'Danh sách liên kết, cây, đồ thị, bảng băm và phân tích độ phức tạp giải thuật.',
            course3.faculty = 'Khoa Khoa học Máy tính',
            course3.semester = 'HK261',
            course3.year = 2026,
            course3.credits = 4,
            course3.theme = 'orange',
            course3.published = true,
            course3.createdAt = coalesce(course3.createdAt, $now)
        """,
        {"now": now},
    )
    print("Seeded sample courses (CO3093, CO3001, CO2003) and default portal content.")


def main() -> None:
    parser = argparse.ArgumentParser(description="G4LMS administrative commands")
    subparsers = parser.add_subparsers(dest="command", required=True)
    admin_parser = subparsers.add_parser("create-admin", help="Create the first administrator")
    admin_parser.add_argument("--email", required=True)
    admin_parser.add_argument("--name", required=True)
    subparsers.add_parser("seed-demo", help="Seed default courses and portal content into Neo4j")
    arguments = parser.parse_args()

    try:
        verify_connectivity()
        ensure_schema()
        if arguments.command == "create-admin":
            create_admin(arguments.email, arguments.name)
        elif arguments.command == "seed-demo":
            seed_demo()
    finally:
        close_driver()



if __name__ == "__main__":
    main()
