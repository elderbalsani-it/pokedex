require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Função para obter os Pokémon no intervalo de IDs
async function getPokemonInRange(startId, endId) {
    let pokemons = [];

    for (let i = startId; i <= endId; i++) {
        try {
            const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${i}`);
            let pokemon = {
                id: response.data.id,
                name: response.data.name,
                height: response.data.height,
                weight: response.data.weight,
                base_experience: response.data.base_experience,
                types: response.data.types.map(t => t.type.name)
            };

            console.log(`✅ Pokémon ${pokemon.name} (ID: ${pokemon.id}) - Tipos:`, pokemon.types);
            pokemons.push(pokemon);
        } catch (error) {
            console.error(`❌ Erro ao obter Pokémon ID ${i}:`, error.message);
        }
    }

    return pokemons;
}

// Função para enviar os Pokémon processados para o Pipefy
async function enviarPokemonsParaPipefy(cardId, pokemons) {
    const PIPEFY_API_URL = "https://api.pipefy.com/graphql";
    const PIPEFY_TOKEN = process.env.PIPEFY_TOKEN;

    if (!PIPEFY_TOKEN) {
        console.error("❌ Erro: PIPEFY_TOKEN não configurado!");
        return;
    }

    const query = `
        mutation {
            updateFieldsValues(input: { 
                card_id: ${cardId}, 
                values: [
                    { field_id: "lista_de_pok_mons", value: "${pokemons.map(p => p.name).join(", ")}" }
                ]
            }) {
                clientMutationId
            }
        }
    `;

    try {
        const response = await axios.post(PIPEFY_API_URL, { query }, {
            headers: {
                "Authorization": `Bearer ${PIPEFY_TOKEN}`,
                "Content-Type": "application/json"
            }
        });

        console.log("📤 Envio para o Pipefy realizado com sucesso:", response.data);
    } catch (error) {
        console.error("❌ Erro ao enviar Pokémon para o Pipefy:", error.response ? error.response.data : error.message);
    }
}

// Rota para processar os Pokémon e enviá-los ao Pipefy
app.post("/process-pokemon", async (req, res) => {
    console.log("🚀 Requisição recebida no endpoint /process-pokemon!");
    console.log("📩 Dados recebidos:", req.body);

    const { startId, endId, types = [], sortBy, order, cardId } = req.body;

    if (!startId || !endId || !sortBy || !order || !cardId) {
        console.log("❌ Erro: Parâmetros inválidos!");
        return res.status(400).json({ error: "Parâmetros inválidos" });
    }

    let pokemons = await getPokemonInRange(startId, endId);

    // Filtragem por tipo
    if (types.length > 0) {
        pokemons = pokemons.filter(pokemon => 
            pokemon.types.some(type => types.includes(type))
        );
    }

    // Ordenação
    pokemons.sort((a, b) => (order === "asc" ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy]));

    console.log("✅ Pokémon processados:", pokemons.map(p => p.name));

    // Enviar os Pokémon processados para o Pipefy
    await enviarPokemonsParaPipefy(cardId, pokemons);

    res.json({ message: "Pokémon processados e enviados para o Pipefy com sucesso", pokemons });
});

// Inicializa o servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`🌐 URL de acesso: http://localhost:${PORT}`);
}).on("error", (err) => {
    console.error("❌ Erro ao iniciar o servidor:", err.message);
});


