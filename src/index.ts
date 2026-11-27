import { defineApiConfig, useFetch } from "./lib/api";

// Demo: declare the API registry once, at module scope.
const api = defineApiConfig({
  pokeapi: {
    baseUri: "https://pokeapi.co/api/v2",
    endpoints: {
      pokemonById: "/pokemon/:id/",
    },
  },
  debug: true,
  getPokemonById: async function () {
    const result = await useFetch("pokeapi", "pokemonById", { params: { id: 25 } });
    if (result.ok) return result.data;
    return null;
  },
});

export default api;
