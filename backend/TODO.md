Gemini, 

1. Adicionar linha de total no card de Registros no Banco, contendo todos os registros no banco.
2. Ao passar o mouse sobre os campos de NFe e MDFe, podemos colocar uma esécie de "hint" com a chave correspondente. O clique para salvar no cliboard não está funcionando corretamente e precisamos corrigir.
3. Ao clicar sobre a AWB, copiar os últimos 8 dígitos para a área de transferência
4. Criar um menu lateral oculto por padrão, mas com um botão lateral para exibi-lo. com ele aberto, teremos os campos de pesquisa que deve filtrar os resultados a serem exibidos. O menu terá o seguinte formato:

Ferramentas (dropdown)
	Importar dados SK (Acionará o nosso atual Importar Franchise Report (SK))
	Importar termos SEFAZ (acionará o nosso atual Importar Termos (SEFAZ-AL))
	Importar malha de voos (Desativado atualmente)
- (Separador)
Pesquisa:
* AWB (terá um "label" acima com AWB: e abaixo o campo para digitar o AWB. Limitar em 8 caracteres e o select deve considerar os campo como "AWB = '577' o que tiver no campo, por exemplo, se o campo tiver 12345678, o resultado do select será algo como SELECT ... WHERE AWB = '57712345678'.
* Termo (semelhante ao acima. limitaremos o campo em 8 caracteres também, mas a pesquisa não terá complemento com outro string, apenas com o que for digitado no campo.)
* Destino (semelhante ao acima em layout, com limitação de campo em 6 caracteres.
* Voo (semelhante aos acima em layout. Limitação de caracteres em 6 caracteres. Nesse caso, caso sejam inseridos apenas 4 caracteres, considerar a pesquisa final com um string 'AD' antes do que foi digitado no campo)
* Data do termo (semelhante aos demais, com um datepicker e formatação de data no padrão dd/mm/yyyy
A pesquisa deve retornar na tela no máximo 1.000 resultados. Caso exceda, retornar erro ao usuário informando que os dados excederam 1.000 resultados e não serão exibidos. Caso

5. Teremos uma nova funcionalidade para importar a malha de voo. Vamos ter que alocar os 3 cards (registros no banco, datas faltantes e voos) lado a lado na tela. Por ora, apenas crie o card sem dados, apenas para vermos como deve ficar na tela, já que vamos desenvolver posteriormente a funcionalidade para identificar o padão dos voos pelo arquivo recebido, criar a funcionalidade de importar, criar uma nova tabela no banco, etc...

6. Verificar a possibilidade de criar um campo de filtro dos dados já exiibdos na tela, logo acima do cabeçalho da tabela. Será um campo apenas e genérico, ou seja, o que for digitado ali, refletirá apenas os resultados que, de alguma forma, contenha aquele texto digitado no campo, independente da coluna. Esse filtro deve afetar apenas os dados já exibidos na tela, ou seja, sem nova consulta em banco.
7. Se possível, criar paginação para os dados exibidos na tabela caso excedam 50 registros.
8. Ao importar os termos, abrir uma tela com os dados dos termos importados, com botão para salvar os dados para o clipboard com os campos separados por tabulação.


## Para as próximas versões

1. Criar um card para informar quais os vôos já foram processados
2. Criar um campo para importar a malha semanal ou informar os vôos que serão processados
10. Configurar servidor de email para envio dos e-mails de termos e da solicitação de análise dos MDFes


## Para teste interno

1. Conferir se o termo que não existir NF correspondente vai aparecer como N/A