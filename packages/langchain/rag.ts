import 'dotenv/config';
import fs from 'fs';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

const { OPENAI_API_KEY, AI_DOCS_NUMBER = '30' } = process.env;
const docsNumberForAI = parseInt(AI_DOCS_NUMBER, 10);

const question = 'What is the best language, Typescript or Javascript, for a large-scale project?';

const loadFileIntoSplits = async (path: string): Promise<Document[]> => {
  const buff = fs.readFileSync(path);
  const loader = new PDFLoader(new Blob([buff]), {
    splitPages: false
  });
  const docs = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  return textSplitter.splitDocuments(docs);
}

(async () => {
  const jsDocs = await loadFileIntoSplits('files/JavaScript.pdf');
  const tsDocs = await loadFileIntoSplits('files/TypeScript.pdf');

  const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
  await vectorStore.addDocuments(jsDocs);
  await vectorStore.addDocuments(tsDocs);
  // const d = new Document()
  // d.pageContent
  // d.metadata

  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    temperature: 0,
    apiKey: OPENAI_API_KEY
  });


  const systemTemplate = `
    You are an assistant for question-answering tasks.
    Use the following pieces of retrieved context to answer 
    the question. If you don't know the answer, say that you
    don't know. Use three sentences maximum and keep the
    answer concise.
    \n\n
    {context}
  `;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemTemplate],
    ['human', '{input}'],
  ]);

  const retriever = vectorStore.asRetriever(
    docsNumberForAI,
    /*{
      // orgId: '1234',
      // sourceType: 'file',
    }*/
  );
  const questionAnswerChain = await createStuffDocumentsChain({
    llm,
    prompt,
  });
  const ragChain = await createRetrievalChain({
    retriever,
    combineDocsChain: questionAnswerChain,
  });
  const results = await ragChain.invoke({
    input: question,
  });

  // console.log(results);
  console.log(`🤔 Question: ${question}\n\n🤖 Answer: ${results.answer}`);
})();

