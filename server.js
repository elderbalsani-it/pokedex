require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const PIPEFY_API_KEY = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NDE5OTc3NTcsImp0aSI6IjY3YTU5YjAxLWU1OTktNDc1Ni04NjBkLTMwZjhjNmQxZjA1MCIsInN1YiI6MzAyNTkxMjczLCJ1c2VyIjp7ImlkIjozMDI1OTEyNzMsImVtYWlsIjoiZWxkZXJiYWxzYW5pQHlhaG9vLmNvbS5iciJ9fQ.5QVnQaahuok6vWwDPh8JFPl_Nupmw4vTUoN4wZRhNuskk5MaDPhtaA5CzdHuCWUNfVfejqGTL6dkhTTERLeUug"; // 🔹 Pegue seu token de API no Pipefy

// Função para aguardar um pequeno delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para obter os Pokémon no intervalo de IDs
async function getPokemonInRange(startId, endId) {
    let pokemons = [];

    console.log(`🔍 Buscando Pokémon do ID ${startId} ao ${endId}...`);

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

            console.log(`✅ Pokémon encontrado: ${pokemon.name} (ID: ${pokemon.id}) - Tipos: ${pokemon.types}`);

            pokemons.push(pokemon);
        } catch (error) {
            console.error(`❌ Erro ao obter Pokémon ID ${i}:`, error.message);
        }
    }

    console.log(`✅ Total de Pokémon obtidos: ${pokemons.length}`);
    return pokemons;
}

// Função para atualizar o Pipefy via GraphQL
async function updatePipefyCard(cardId, formattedList) {
    const pipefyGraphQLUrl = "https://api.pipefy.com/graphql";

    const mutationQuery = {
        query: `
            mutation {
                updateCard(input: { id: ${cardId}, fields_attributes: [{ field_id: "lista_de_pok_mons", field_value: """${formattedList}""" }] }) {
                    card {
                        id
                    }
                }
            }
        `
    };

    try {
        const response = await axios.post(pipefyGraphQLUrl, mutationQuery, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${PIPEFY_API_KEY}`
            }
        });

        console.log("✅ Lista de Pokémons enviada para o Pipefy!");
        return response.data;
    } catch (error) {
        console.error("❌ Erro ao atualizar o card no Pipefy:", error.response ? error.response.data : error.message);
    }
}

// Rota para receber pedidos do Pipefy
app.post("/process-pokemon", async (req, res) => {
    console.log("📥 Requisição recebida do Pipefy:", req.body); // 🔹 LOG para depuração

    let { id_inicial, id_final, tipo_de_pokemon, crit_rio_de_ordena_o, classifica_o, cardId } = req.body;

    // Conversão de tipos para garantir que os dados estejam corretos
    let startId = Number(id_inicial);
    let endId = Number(id_final);
    let sortBy = crit_rio_de_ordena_o ? crit_rio_de_ordena_o.toString() : null;
    let order = classifica_o ? classifica_o.toString() : "asc";
    let types = Array.isArray(tipo_de_pokemon) ? tipo_de_pokemon : [tipo_de_pokemon];
    let listaDePokemonsFieldId = "401223328"; // ID correto do campo de Lista de Pokémons

    console.log(`🔍 Valores recebidos após ajustes: startId=${startId}, endId=${endId}, types=${JSON.stringify(types)}, sortBy=${sortBy}, order=${order}, cardId=${cardId}`);


    // Validação dos parâmetros obrigatórios
    if (!startId || !endId || !sortBy || !order || !cardId) {
        console.error("❌ Parâmetros inválidos recebidos:", req.body);
        return res.status(400).json({ 
            error: "Parâmetros inválidos. Certifique-se de enviar startId, endId, sortBy, order e cardId." 
        });
    }

    // Adiciona um pequeno delay antes de iniciar o processamento (simulação de atraso)
    console.log("⏳ Aplicando pequeno delay antes do processamento...");
    await delay(2000); // Delay de 2 segundos

    let pokemons = await getPokemonInRange(startId, endId);

    // Filtragem por tipo (caso fornecido)
    if (types.length > 0) {
        console.log(`🛠 Filtrando Pokémon pelos tipos: ${types}`);
        pokemons = pokemons.filter(pokemon => 
            pokemon.types.some(type => types.includes(type))
        );
    }

    // Verificação se há Pokémon após a filtragem
    if (pokemons.length === 0) {
        console.warn("⚠ Nenhum Pokémon encontrado após a filtragem!");
        return res.status(200).json({ 
            message: "Nenhum Pokémon encontrado com os critérios fornecidos.", 
            pokemons: [] 
        });
    }

    // Ordenação dos Pokémon
    const validSortFields = ["height", "weight", "base_experience"];
    if (validSortFields.includes(sortBy)) {
        console.log(`📊 Ordenando Pokémon por ${sortBy} em ordem ${order}`);
        pokemons.sort((a, b) => (order === "asc" ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy]));
    } else {
        console.error(`❌ Critério de ordenação inválido: ${sortBy}`);
        return res.status(400).json({ 
            error: `Critério de ordenação inválido. Use 'height', 'weight' ou 'base_experience'.` 
        });
    }

    // 🔹 Formata os Pokémon para uma lista amigável
    let formattedList = pokemons.map(p => `🔹 ${p.name} (ID: ${p.id}) - Tipos: ${p.types.join(", ")}`).join("\n");

    // 🔹 Atualiza o Pipefy com a lista formatada
    await updatePipefyCard(cardId, formattedList);

    // Retorno da resposta
    console.log("✅ Pokémon processados com sucesso. Enviando resposta...");
    res.json({ message: "Pokémon processados com sucesso", pokemons });
});

// Inicializa o servidor
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
