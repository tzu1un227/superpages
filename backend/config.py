import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev_secret_key'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Add other configuration variables here if needed
