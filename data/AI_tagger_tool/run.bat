@echo off
cd /d "%~dp0"
if not exist .venv (
    echo Tao moi truong ao .venv ...
    python -m venv .venv || (echo Khong tim thay Python. Cai Python 3.10+ tu python.org & pause & exit /b 1)
)
call .venv\Scripts\activate
python -m pip install -q -r requirements.txt
if not exist .env copy .env.example .env >nul
streamlit run app.py
