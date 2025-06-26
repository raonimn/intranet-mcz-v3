const xlsx = require('xlsx');
const { insertOrUpdateFranchiseReport } = require('./database');


// Função para validar o arquivo XLSX antes de processá-lo
const validarArquivoXLSX = (caminhoArquivo) => {
  try {
    // Verificar se o arquivo é do tipo XLSX
    if (!caminhoArquivo.endsWith('.xlsx')) {
      throw new Error('O arquivo não é do tipo XLSX.');
    }

    // Carregar o arquivo XLSX
    const workbook = xlsx.readFile(caminhoArquivo);

    // Verificar a estrutura esperada do arquivo
    const folhasEsperadas = ['Sheet1', 'Sheet2', 'Sheet3', 'Report']; // Altere conforme necessário
    folhasEsperadas.forEach((folha) => {
      if (!workbook.Sheets[folha]) {
        throw new Error(`A folha de trabalho '${folha}' não foi encontrada.`);
      }
    });

    // Processar o arquivo XLSX
    const dados = xlsx.utils.sheet_to_json(workbook.Sheets['Sheet1']); // Altere conforme necessário
    insertOrUpdateFranchiseReport(dados);

    console.log('Arquivo XLSX processado com sucesso.');
  } catch (erro) {
    console.error('Erro ao processar o arquivo XLSX:', erro.message);
  }
};

// Exemplo de uso
validarArquivoXLSX('caminho/do/arquivo.xlsx');
