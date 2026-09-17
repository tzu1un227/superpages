@echo off
ping -n 2 8.8.8.8 > C:\LineBotServer\net_test.txt
nslookup github.com >> C:\LineBotServer\net_test.txt 2>&1
