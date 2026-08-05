import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else "https://ciber-educativo.preview.emergentagent.com"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def student_token():
    return os.environ.get("STUDENT_TOKEN", "")


@pytest.fixture(scope="session")
def teacher_token():
    return os.environ.get("TEACHER_TOKEN", "")


@pytest.fixture()
def student_client(student_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {student_token}"})
    return s


@pytest.fixture()
def teacher_client(teacher_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {teacher_token}"})
    return s


@pytest.fixture()
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
