// Export data to Excel CSV format with UTF-8 BOM for perfect Excel compatibility
export function exportToExcel(data, filename = 'Hisobot') {
  if (!data || !data.length) {
    alert("Yuklab olish uchun ma'lumotlar mavjud emas")
    return
  }

  const keys = Object.keys(data[0])
  const csvRows = []

  // Header row
  csvRows.push(keys.map((k) => `"${k}"`).join(','))

  // Data rows
  for (const row of data) {
    const values = keys.map((k) => {
      const val = row[k] === null || row[k] === undefined ? '' : String(row[k])
      const escaped = val.replace(/"/g, '""')
      return `"${escaped}"`
    })
    csvRows.push(values.join(','))
  }

  const csvString = csvRows.join('\r\n')

  // Add UTF-8 BOM (\uFEFF) so Excel opens Uzbek characters without encoding bugs
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Export report or table to printable PDF layout
export function exportToPdf(title, data, columns) {
  if (!data || !data.length) {
    alert("Yuklab olish uchun ma'lumotlar mavjud emas")
    return
  }

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) return

  const dateStr = new Date().toLocaleDateString('uz-UZ')

  const headersHtml = columns.map((c) => `<th style="padding: 8px; border: 1px solid #cbd5e1; background: #f1f5f9; text-align: left;">${c.header}</th>`).join('')

  const rowsHtml = data
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => `<td style="padding: 8px; border: 1px solid #e2e8f0;">${c.accessor(row) ?? '—'}</td>`)
          .join('')}</tr>`
    )
    .join('')

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
        h1 { font-size: 20px; color: #0369a1; text-transform: uppercase; margin-bottom: 4px; }
        p { font-size: 12px; color: #64748b; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <h1>MARJONA MED SERVICE — ${title}</h1>
      <p>Sana: ${dateStr} | Tayyorlandi: Marjona Med Servis Tizimi</p>
      <table>
        <thead><tr>${headersHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}
