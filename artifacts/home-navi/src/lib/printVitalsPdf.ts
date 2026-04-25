export function printVitalsPdf(statuses: any[], dateStr: string) {
  const recorded = statuses.filter((s) => s.recordedToday && s.latestVital);

  const [year, month, day] = dateStr.split("-");
  const dateJp = `${year}/${month}/${day}`;

  const rows = recorded
    .sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), "ja"))
    .map((s) => {
      const v = s.latestVital;
      const bp =
        v.bpSystolic != null && v.bpDiastolic != null
          ? `${v.bpSystolic} / ${v.bpDiastolic}`
          : "-";
      const kt = v.temperature != null ? v.temperature : "-";
      const pulse = v.pulse != null ? v.pulse : "-";
      const spo2 = v.spo2 != null ? v.spo2 : "-";
      return `
        <tr>
          <td>${s.roomNumber}</td>
          <td>${s.residentName}&nbsp;様</td>
          <td>${kt}</td>
          <td>${bp}</td>
          <td>${pulse}</td>
          <td>${spo2}</td>
        </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>バイタル一覧 ${dateJp}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 15mm 18mm 15mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
      font-size: 10pt;
      color: #111;
    }
    .header {
      text-align: center;
      margin-bottom: 12pt;
    }
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4pt;
    }
    .header h2 {
      font-size: 11pt;
      font-weight: normal;
    }
    .date-line {
      text-align: right;
      font-size: 10pt;
      margin-bottom: 8pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #888;
      padding: 5pt 6pt;
      text-align: center;
    }
    th {
      background: #f0f0f0;
      font-weight: bold;
      font-size: 10pt;
    }
    td:nth-child(1) { width: 48pt; }
    td:nth-child(2) { text-align: left; width: 120pt; }
    td:nth-child(3) { width: 44pt; }
    td:nth-child(4) { width: 60pt; }
    td:nth-child(5) { width: 36pt; }
    td:nth-child(6) { width: 42pt; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ハグライフ南摂津＿利用者バイタル一覧</h1>
    <h2>かえでファミリークリニック</h2>
  </div>
  <div class="date-line">${dateJp}</div>
  <table>
    <thead>
      <tr>
        <th>部屋</th>
        <th>利用者名</th>
        <th>体温</th>
        <th>血圧</th>
        <th>脈</th>
        <th>SPO2</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center">記録済みデータがありません</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("ポップアップがブロックされています。ポップアップを許可してください。");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 400);
}
