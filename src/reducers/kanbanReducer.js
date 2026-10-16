// kanbanReducer.js

/**
 * Estado das colunas do Kanban, uma entrada por coluna:
 * { [stage]: { contacts: [], page: 0, count: null, hasMore: true, loading: false, error: null } }
 */
export function emptyStage() {
  return { contacts: [], page: 0, count: null, hasMore: true, loading: false, error: null };
}

export function kanbanReducer(state, action) {
  switch (action.type) {
    case 'RESET': {
      // payload: lista de colunas
      return action.payload.reduce((acc, stage) => {
        acc[stage] = emptyStage();
        return acc;
      }, {});
    }

    case 'STAGE_LOADING': {
      const { stage } = action.payload;
      if (!state[stage]) return state;
      return { ...state, [stage]: { ...state[stage], loading: true, error: null } };
    }

    case 'STAGE_LOADED': {
      const { stage, page, contacts, count } = action.payload;
      const current = state[stage];
      if (!current) return state;
      // Evita duplicados (a lista pode mudar entre páginas) e cards que já estão em outra coluna
      const elsewhere = new Set();
      Object.entries(state).forEach(([s, col]) => {
        if (s !== stage) col.contacts.forEach(c => elsewhere.add(c.id));
      });
      const seen = new Set(current.contacts.map(c => c.id));
      const fresh = contacts.filter(c => !seen.has(c.id) && !elsewhere.has(c.id));
      const merged = [...current.contacts, ...fresh];
      const hasMore = contacts.length > 0 && (count === null || merged.length < count);
      return {
        ...state,
        [stage]: { ...current, contacts: merged, page, count, hasMore, loading: false, error: null }
      };
    }

    case 'STAGE_ERROR': {
      const { stage, error } = action.payload;
      if (!state[stage]) return state;
      return { ...state, [stage]: { ...state[stage], loading: false, error } };
    }

    case 'MOVE_CARD': {
      // attributes: { chave: valor } a atualizar no card (valor undefined remove a chave)
      const { source, destination, contactId, index, attributes = {} } = action.payload;
      const from = state[source];
      const to = state[destination];
      if (!from || !to) return state;
      const original = from.contacts.find(c => c.id === contactId);
      if (!original) return state;
      const customAttributes = { ...(original.custom_attributes || {}) };
      Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'undefined') delete customAttributes[key];
        else customAttributes[key] = value;
      });
      const contact = { ...original, custom_attributes: customAttributes };
      if (source === destination) {
        const list = from.contacts.filter(c => c.id !== contactId);
        list.splice(index, 0, contact);
        return { ...state, [source]: { ...from, contacts: list } };
      }
      const destList = [...to.contacts];
      destList.splice(index, 0, contact);
      const dec = n => (typeof n === 'number' ? Math.max(0, n - 1) : n);
      const inc = n => (typeof n === 'number' ? n + 1 : n);
      return {
        ...state,
        [source]: { ...from, contacts: from.contacts.filter(c => c.id !== contactId), count: dec(from.count) },
        [destination]: { ...to, contacts: destList, count: inc(to.count) }
      };
    }

    default:
      return state;
  }
}
