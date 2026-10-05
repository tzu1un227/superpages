import os
import secrets

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_urlsafe(32)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Add other configuration variables here if needed
