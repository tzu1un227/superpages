# -*- coding: utf-8 -*-
from app import create_app
from models import OAConfig
app = create_app()
with app.app_context():
    for oa in OAConfig.query.all():
        print(f'{oa.oa_name}: {type(oa.other_settings)}')
        if isinstance(oa.other_settings, dict):
            print(f"   app_name: {oa.other_settings.get('app_name')}")
