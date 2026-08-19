import { ApolloClient, InMemoryCache } from '@apollo/client';

export const client = new ApolloClient({
  uri: import.meta.env.VITE_VETCARE_API_URL,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Карта прививок живёт в кэше 5 минут: она почти не меняется, а открывают её
          // на каждом приёме. Остальные запросы ходят на сервер каждый раз.
          vaccinationCard: { maxAge: 300 },
        },
      },
    },
  }),
});
