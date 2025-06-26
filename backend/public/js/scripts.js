// scripts/scripts.js
document.getElementById('xlsxInput').addEventListener('change', function(event) {
    const xlsxDataBody = document.getElementById('xlsxDataBody');
    xlsxDataBody.innerHTML = '';
  
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
  
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
  
      jsonData.forEach(entry => {
        const row = document.createElement('tr');
        const columnsToDisplay = ['B', 'D', 'I', 'J', 'T', 'BC'];
  
        columnsToDisplay.forEach(column => {
          const cell = document.createElement('td');
          cell.textContent = entry[column];
          row.appendChild(cell);
        });
  
        xlsxDataBody.appendChild(row);
      });
    };
  
    reader.readAsArrayBuffer(event.target.files[0]);
  });
  
  function adicionarDados(elementId) {
    document.getElementById(elementId).addEventListener('change', function(event) {
      const fileListDiv = document.getElementById('fileList');
      fileListDiv.innerHTML = '';
  
      Array.from(event.target.files).forEach(file => {
        const fileNameParagraph = document.createElement('p');
        fileNameParagraph.textContent = file.name;
        fileNameParagraph.style.textAlign = 'center';
        fileListDiv.appendChild(fileNameParagraph);
      });
    });
  }