# 後慈湖售票系統 POS Portal v4.2 PRO

後慈湖現場售票、驗票、出園與即時統計入口整合頁。v4.2 已新增 GitHub Pages 售票前台。

## 頁面

- `index.html`：POS 入口首頁
- `pos-login.html`：售票登入頁
- `sale.html`：GitHub Pages 售票前台
- `pos-api.js`：前端呼叫 Apps Script API
- `print.css`：58mm 熱感紙列印樣式
- `apps-script/Code.gs`：Apps Script 後端範本

## 入口功能

- 開始售票：GitHub POS 前台
- 驗票入口 B 點：QR Code 驗票
- 出園／A 點：離園人數登錄
- 今日統計：即時人流與營運統計

## Apps Script 設定

請在 Apps Script 的「專案設定 → 指令碼屬性」設定：

- `POS_KEY`：售票登入用金鑰
- `POS_SHEET_ID`：售票交易 Google Sheets ID；若 Apps Script 綁定在試算表，可不填

設定後請重新部署 Web App 新版本。

## 使用提醒

- 建議使用手機或平板操作。
- 售票前請確認網路、印表機與票券紙卷。
- GitHub Pages 只放售票畫面，不存放旅客個資。
- 售票交易資料由 Apps Script 寫入 Google Sheets 的 `交易紀錄` 工作表。
