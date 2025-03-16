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
            
            console.log(`Pokémon ${pokemon.name} (ID: ${pokemon.id}) - Tipos:`, pokemon.types);

            pokemons.push(pokemon);
        } catch (error) {
            console.error(`Erro ao obter Pokémon ID ${i}:`, error.message);
        }
    }

    return pokemons;
}


// Rota para receber pedidos do Pipefy
app.post("/process-pokemon", async (req, res) => {
    const { startId, endId, types = [], sortBy, order } = req.body;

    if (!startId || !endId || !sortBy || !order) {
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

    res.json({ message: "Pokémon processados com sucesso", pokemons });
});

// Inicializa o servidor
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// Exemplo de requisição POST para a rota /process-pokemon
