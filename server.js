import express from 'express';
import cors from 'cors';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import input from 'input';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============ SUAS CREDENCIAIS DO TELEGRAM ============
const api_id = 34303434;  // ⚠️ TROQUE PELO SEU
const api_hash = '5d521f53f9721a6376586a014b51173d';  // ⚠️ TROQUE PELA SUA
const target_chat = -1002421438612;
const bot_confiavel = 'QueryBuscasBot';

// ⚠️ IMPORTANTE: Após primeiro login, cole aqui a session string
const stringSession = new StringSession('');

const client = new TelegramClient(stringSession, api_id, api_hash, {
    connectionRetries: 5,
});

// ============ INICIALIZAÇÃO DO TELEGRAM ============
async function startClient() {
    console.log('🔄 Conectando ao Telegram...');
    try {
        await client.start({
            phoneNumber: async () => await input.text('Digite seu número (+5511...): '),
            password: async () => await input.text('Senha 2FA (se tiver): '),
            phoneCode: async () => await input.text('Código recebido: '),
            onError: (err) => console.error('❌ Erro:', err),
        });
        console.log('✅ Telegram conectado!');
        console.log('');
        console.log('📋 COPIE E SALVE ESTA SESSION STRING:');
        console.log(client.session.save());
        console.log('');
        console.log('⚠️ Cole ela no código (linha 20) para não precisar fazer login novamente!');
    } catch (error) {
        console.error('❌ Erro ao conectar:', error);
    }
}

// Inicia conexão com Telegram
startClient();

// ============ FUNÇÃO DE BUSCA NO TELEGRAM ============
async function buscarNoTelegram(mensagemUsuario) {
    if (!client.connected) {
        await client.connect();
    }

    const comando = mensagemUsuario.startsWith('/') 
        ? mensagemUsuario 
        : `/${mensagemUsuario}`;

    return new Promise(async (resolve, reject) => {
        let timeoutId;
        
        const handler = async (event) => {
            try {
                if (event.message && event.message.media) {
                    const sender = await event.message.getSender();
                    
                    if (sender && sender.username === bot_confiavel) {
                        console.log('📥 Recebendo resposta do bot...');
                        
                        const buffer = await client.downloadMedia(event.message, {});
                        
                        let conteudo = "";
                        if (buffer) {
                            conteudo = buffer.toString('utf-8');
                        } else {
                            conteudo = "Arquivo recebido mas não foi possível ler o conteúdo.";
                        }
                        
                        clearTimeout(timeoutId);
                        client.removeEventHandler(handler);
                        resolve(conteudo);
                    }
                }
            } catch (error) {
                console.error('❌ Erro no handler:', error);
                clearTimeout(timeoutId);
                client.removeEventHandler(handler);
                reject(error);
            }
        };

        client.addEventHandler(handler, new NewMessage({ chats: [target_chat] }));

        try {
            console.log('📤 Enviando comando:', comando);
            await client.sendMessage(target_chat, { message: comando });
            console.log('✅ Comando enviado! Aguardando resposta...');
        } catch (error) {
            console.error('❌ Erro ao enviar:', error);
            client.removeEventHandler(handler);
            reject(error);
            return;
        }

        timeoutId = setTimeout(() => {
            console.log('⏱️ Timeout atingido');
            client.removeEventHandler(handler);
            reject(new Error("⏱️ Timeout - O bot demorou muito para responder. Tente novamente."));
        }, 45000);
    });
}

// ============ ROTAS DA API ============

// Rota principal - serve o frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de health check
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        telegram_connected: client.connected,
        timestamp: new Date().toISOString()
    });
});

// Rota da API para perguntas
app.post('/perguntar', async (req, res) => {
    const pergunta = req.body.pergunta || '';

    if (!pergunta) {
        return res.status(400).json({ 
            resposta: "❌ Nenhuma pergunta foi enviada." 
        });
    }

    console.log('📨 Nova pergunta recebida:', pergunta);

    try {
        const resposta = await buscarNoTelegram(pergunta);
        console.log('✅ Resposta obtida com sucesso!');
        res.json({ resposta });
    } catch (error) {
        console.error('❌ Erro ao processar:', error);
        res.status(500).json({ 
            resposta: `❌ Erro: ${error.message}` 
        });
    }
});

// ============ INICIAR SERVIDOR ============
const listener = app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log('');
    console.log('🔥 ================================');
    console.log('🔥 Firebase AI - Servidor Online!');
    console.log('🔥 ================================');
    console.log('');
    console.log('📡 Porta:', listener.address().port);
    console.log('🌐 Acesse: http://localhost:' + listener.address().port);
    console.log('');
    console.log('📋 Rotas disponíveis:');
    console.log('   GET  /        - Frontend (Chat)');
    console.log('   GET  /health  - Status da API');
    console.log('   POST /perguntar - Enviar perguntas');
    console.log('');
});

