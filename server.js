require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Mapeamento de critérios de ordenação
const CRITERIA_MAP = {
  "Peso": "weight",
  "Altura": "height",
  "Experiência Base": "base_experience"
};

// Função para processar Pokémon
async function processPokemon(startId, endId, types, sortBy, order) {
  try {
    const pokemons = [];
    
    for (let id = startId; id <= endId; id++) {
      try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const pokemonData = response.data;
        
        const pokemon = {
          id: pokemonData.id,
          name: pokemonData.name,
          height: pokemonData.height,
          weight: pokemonData.weight,
          base_experience: pokemonData.base_experience,
          types: pokemonData.types.map(t => t.type.name)
        };

        // Filtragem por tipos
        if (types.length === 0 || types.some(type => pokemon.types.includes(type))) {
          pokemons.push(pokemon);
        }
      } catch (error) {
        console.error(`Erro no Pokémon ${id}:`, error.message);
      }
    }

    // Ordenação
    const sortField = CRITERIA_MAP[sortBy] || "weight";
    pokemons.sort((a, b) => 
      order.toLowerCase() === "asc" ? a[sortField] - b[sortField] : b[sortField] - a[sortField]
    );

    return pokemons;
  } catch (error) {
    throw new Error(`Erro no processamento: ${error.message}`);
  }
}

app.post("/process-pokemon", async (req, res) => {
  try {
    // Validação do corpo da requisição
    const requiredFields = ["startId", "endId", "types", "sortBy", "order", "cardId"];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Campos obrigatórios faltando: ${missingFields.join(", ")}`
      });
    }

    // Processamento dos parâmetros
    const params = {
      startId: Number(req.body.startId),
      endId: Number(req.body.endId),
      types: Array.isArray(req.body.types) ? req.body.types : req.body.types.split(",").map(t => t.trim().toLowerCase()),
      sortBy: req.body.sortBy,
      order: req.body.order.toLowerCase(),
      cardId: req.body.cardId
    };

    // Validação adicional
    if (params.startId > params.endId) {
      return res.status(400).json({
        error: "ID Final deve ser maior que ID Inicial"
      });
    }

    // Processamento dos Pokémon
    const pokemons = await processPokemon(
      params.startId,
      params.endId,
      params.types,
      params.sortBy,
      params.order
    );

    // Formatação da resposta para o Pipefy
    const responseData = {
      card_id: params.cardId,
      pokemons: pokemons.map(p => ({
        name: p.name,
        id: p.id,
        details: `Altura: ${p.height} | Peso: ${p.weight} | Exp: ${p.base_experience} | Tipos: ${p.types.join(", ")}`
      }))
    };

    res.status(200).json(responseData);
    
  } catch (error) {
    console.error("Erro geral:", error);
    res.status(500).json({
      error: "Erro interno no servidor",
      details: error.message
    });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));