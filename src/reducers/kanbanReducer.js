// kanbanReducer.js

/**
 * Reduz o estado das colunas do Kanban com base na ação recebida.
 *
 * @param {Object} state Estado atual das colunas (ex: { "Novo": [contatos], "Fechado": [contatos] })
 * @param {{ type: string, payload: any }} action Ação a ser processada
 * @returns {Object} Novo estado atualizado
 */
export function kanbanReducer(state, action) {
  switch (action.type) {
    case 'INIT': {
      return typeof action.payload === 'object' && action.payload !== null
        ? action.payload
        : state;
    }

    case 'MOVE_CARD': {
      const { source, destination, contact } = action.payload;

      const newState = {
        ...state,
        [source]: [...(state[source] || [])],
        [destination]: [...(state[destination] || [])],
      };

      newState[source] = newState[source].filter(c => c.id !== contact.id);
      newState[destination] = newState[destination].filter(c => c.id !== contact.id);
      newState[destination].push(contact);

      return newState;
    }

    default:
      return state;
  }
}
