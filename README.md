# 📊 Cyclomatic Complexity Analyzer (CCA) para JS/TS

O **Cyclomatic Complexity Analyzer (CCA)** é uma ferramenta de análise estática de código dedicada a medir e visualizar a Complexidade Ciclomática (CC) em projetos JavaScript e TypeScript. Ele oferece uma visão granular da saúde estrutural do seu código, ajudando você a identificar funções complexas que podem ser difíceis de testar e manter.

## ✨ Funcionalidades Principais

  * **Análise Granular de CC:** Calcula a Complexidade Ciclomática (CC) para **cada função** dentro de seus arquivos `.js`, `.ts`
  * **Métrica de Saúde do Projeto:** Fornece a **Complexidade Ciclomática Média do Projeto (CCMédia)**, oferecendo um *benchmark* rápido e acionável da qualidade geral do código.
  * **Visualização Interativa da AST:** Ao clicar em um arquivo, visualize a **Árvore de Sintaxe Abstrata (AST)** gerada, com nós de controle de fluxo (como `if`, `while`, `for`, `case`, `&&`, `||`, etc.) destacados para mostrar **como** o valor da CC é calculado.
  * **Relatórios e Priorização:** Lista funções e arquivos por ordem decrescente de CC, permitindo que você priorize refatorações.

## 🚀 Como Usar

### Instalação

#### 1\. Via NPM ou Yarn

Instale o pacote como uma dependência de desenvolvimento no seu projeto:

```bash
npm install --save-dev cyclomatic-complexity-analyzer
# ou
yarn add --dev cyclomatic-complexity-analyzer
```

#### 2\. Executando a Análise

Você pode executar a ferramenta diretamente a partir da linha de comando, especificando o diretório raiz do seu projeto ou os arquivos que deseja analisar.

**Exemplo no `package.json`:**

Adicione um *script* para facilitar a execução:

```json
"scripts": {
  "analyze:cc": "cca analyze ./src --threshold 10"
}
```

Execute o *script*:

```bash
npm run analyze:cc
```

### Opções de Linha de Comando

| Opção | Descrição | Exemplo |
| :--- | :--- | :--- |
| `--path <dir>` | O diretório base para análise (obrigatório). | `./src` |
| `--threshold <num>` | O valor de CC máximo aceitável para funções (padrão: `10`). Funções acima deste limite são marcadas. | `--threshold 8` |
| `--format <type>` | Formato da saída (`cli` ou `json`). | `--format json` |
| `--exclude <pattern>`| Padrão glob para excluir arquivos/pastas (e.g., `**/__tests__/**`). | `--exclude '**/vendor/**'` |

## 💻 Interface do Usuário (CLI/Web)

O CCA apresenta os resultados de maneira clara e hierárquica:

### 1\. Resumo do Projeto

| Métrica | Valor |
| :--- | :--- |
| **Arquivos Analisados** | N |
| **Total de Funções** | M |
| **Complexidade Ciclomática Média (CCMédia)** | **4.5** (Idealmente \< 6) |
| **Funções Acima do Limite (CC \> 10)** | K |

### 2\. Detalhamento por Arquivo

É apresentada uma lista de arquivos, ordenada por complexidade total.

| Arquivo | CC Total | CC Média | Funções Críticas |
| :--- | :--- | :--- | :--- |
| `src/controllers/userController.ts` | **35** | 7.0 | 2 |
| `src/utils/formatter.js` | 12 | 3.0 | 0 |

### 3\. Visualização da AST (Modo Interativo)

Ao selecionar um arquivo, a interface interativa permite navegar pela AST da função. Os nós que aumentam a complexidade (e.g., `IfStatement`, `ForStatement`, `LogicalExpression` (`&&`, `||`)) são visualmente destacados, e um contador dinâmico mostra o CC acumulado.

> 📝 **Nota:** Uma CC ideal é geralmente **inferior a 10**. Valores acima de 20 sugerem alta complexidade e necessidade urgente de refatoração (dividir a função em partes menores).

## 🛠️ Como Contribuir

Contribuições são muito bem-vindas\! Sinta-se à vontade para abrir uma `issue` para reportar *bugs* ou sugerir novas funcionalidades.

1.  Faça um *fork* do repositório.
2.  Crie uma *branch* para sua funcionalidade (`git checkout -b feature/minha-feature`).
3.  Faça o *commit* de suas alterações (`git commit -am 'feat: Adiciona nova funcionalidade X'`).
4.  Faça o *push* para a *branch* (`git push origin feature/minha-feature`).
5.  Abra um *Pull Request* (PR).

## 📜 Licença

Este projeto está licenciado sob a [Licença MIT](https://www.google.com/search?q=LICENSE).