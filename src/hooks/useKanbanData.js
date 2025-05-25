import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { getContacts, getCustomAttributes, updateContactCustomAttribute } from '../api';

export function useDynamicKanbanData(reloadFlag = 0) {
  const location = useLocation();

  // Estado para armazenar contatos filtrados (com atributos que começam com 'kbw_' e não nulos)
  const [contacts, setContacts] = useState([]);

  // Estado para armazenar o atributo customizado atual (guardando só campos essenciais)
  const [attribute, setAttribute] = useState(null);

  // Estado para armazenar todos os atributos do tipo lista (para dropdown)
  const [listAttributes, setListAttributes] = useState([]);

  // Estados para controle de carregamento e erros
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Refs para armazenar o último parâmetro da URL e o último atributo selecionado
  const lastParamRef = useRef(null);
  const lastAttributeKeyRef = useRef(null);

  // Memoização das colunas para evitar re-renderizações desnecessárias
  // Colunas são os valores do atributo customizado (tipo lista)
  const columns = useMemo(() => {
    if (!attribute) return [];
    return attribute.attribute_values || [];
  }, [attribute]);

  // Memo para mapear displayNames dos atributos do tipo lista
  const displayNames = useMemo(() => {
    const map = {};
    listAttributes.forEach(attr => {
      map[attr.attribute_key] = attr.attribute_display_name || attr.attribute_key;
    });
    return map;
  }, [listAttributes]);

  useEffect(() => {
    // Extrai o parâmetro 'kbw' da URL
    const searchParams = new URLSearchParams(location.search);
    const param = searchParams.get('kbw');

    console.group('[DEBUG] useDynamicKanbanData: Efeito disparado');
    console.log('[DEBUG] Parâmetro atual da URL (kbw):', param);
    console.log('[DEBUG] Parâmetro anterior:', lastParamRef.current);

    // Evita recarregar se o parâmetro 'kbw' não mudou
    if (lastParamRef.current === param) {
      console.log('[DEBUG] Parâmetro igual ao anterior, efeito abortado');
      console.groupEnd();
      return;
    }
    lastParamRef.current = param;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        let attrs = [];
        let selectedAttr = null;

        // Busca todos os atributos customizados do tipo 'contact_attribute'
        attrs = await getCustomAttributes();
        // Salva todos os atributos do tipo lista e com valores válidos para o dropdown
        const validListAttrs = attrs.filter(
          a => a.attribute_display_type === 'list' && a.attribute_values?.length
        );
        setListAttributes(validListAttrs);
        console.log('[DEBUG] Atributos carregados:', attrs.map(a => a.attribute_key));

        // Seleciona o atributo conforme o parâmetro exato da URL, se existir
        if (param) {
          selectedAttr = attrs.find(
            a => a.attribute_display_type === 'list' && a.attribute_key === param
          );
          console.log('[DEBUG] Atributo selecionado via parâmetro:', selectedAttr?.attribute_key);
        }

        // Se não encontrou pelo parâmetro, tenta pegar o primeiro atributo do tipo lista que comece com "kbw_"
        if (!selectedAttr) {
          selectedAttr = attrs.find(
            a => a.attribute_display_type === 'list' && a.attribute_key.startsWith('kbw_')
          );
          console.log('[DEBUG] Atributo selecionado por fallback (kbw_):', selectedAttr?.attribute_key);
        }

        // Se ainda não encontrou, pega o primeiro atributo do tipo lista disponível
        if (!selectedAttr) {
          selectedAttr = attrs.find(a => a.attribute_display_type === 'list');
          console.log('[DEBUG] Atributo selecionado por fallback (qualquer lista):', selectedAttr?.attribute_key);
        }

        // Se não achou nenhum atributo do tipo lista, lança erro
        if (!selectedAttr) throw new Error('Nenhum atributo tipo lista encontrado.');

        // Busca todos os contatos
        const contactsData = await getContacts();

        // Traz todos os contatos, sem filtrar por atributos kbw_
        setContacts(contactsData);

        // Atualiza o estado do atributo apenas se o atributo selecionado mudou
        if (lastAttributeKeyRef.current !== selectedAttr.attribute_key) {
          // Guarda só os campos essenciais para evitar problemas e re-render desnecessário
          setAttribute({
            attribute_key: selectedAttr.attribute_key,
            attribute_values: selectedAttr.attribute_values
          });
          lastAttributeKeyRef.current = selectedAttr.attribute_key;
          console.log('[DEBUG] Estado attribute atualizado!');
        } else {
          console.log('[DEBUG] Atributo igual ao anterior, estado attribute não atualizado. Apenas contatos atualizados.');
        }

      } catch (err) {
        setError(err);
        console.error('[DEBUG] Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
        console.groupEnd();
      }
    }

    fetchData();
  }, [location.search, reloadFlag]);

  // Retorna os dados e estados do hook para o componente consumir
  return { contacts, columns, attribute, listAttributes, displayNames, loading, error };
}

// Hook para atualização de atributo customizado de contato
export function useUpdateContactAttribute(onSuccess, attribute, contactsFromHook) {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  // Função para atualizar atributo customizado no backend
  const updateContactAttribute = async (contactId, attributeKey, value) => {
    // Se o valor for undefined, apaga a chave do atributo customizado
    if (typeof value === 'undefined') {
      setUpdating(true);
      setUpdateError(null);
      try {
        // Usa contacts do hook se disponível, senão faz fetch
        let contact;
        if (Array.isArray(contactsFromHook)) {
          contact = contactsFromHook.find(c => c.id === contactId);
        }
        if (!contact) {
          const contacts = await getContacts();
          contact = contacts.find(c => c.id === contactId);
        }
        const customAttrs = { ...(contact?.custom_attributes || {}) };
        delete customAttrs[attributeKey];
        await updateContactCustomAttribute(contactId, attributeKey, undefined); // Para compatibilidade
        // Atualiza todo o objeto custom_attributes sem a chave
        await updateContactCustomAttribute(contactId, '', customAttrs);
        if (typeof onSuccess === 'function') {
          onSuccess();
        }
      } catch (error) {
        setUpdateError(error);
        console.error('[DEBUG] Erro ao remover atributo do contato:', error);
      } finally {
        setUpdating(false);
      }
      return;
    }
    // Validação: valor deve ser um dos valores válidos da coluna
    if (typeof value !== 'undefined' && (!Array.isArray(attribute?.attribute_values) || !attribute.attribute_values.includes(value))) {
      const errMsg = `[DEBUG] Valor inválido para coluna: "${value}". Valores permitidos: ${JSON.stringify(attribute?.attribute_values)}`;
      setUpdateError(new Error(errMsg));
      console.error(errMsg);
      return;
    }
    setUpdating(true);
    setUpdateError(null);
    try {
      await updateContactCustomAttribute(contactId, attributeKey, value);
      if (typeof onSuccess === 'function') {
        onSuccess(); // Chama callback de sucesso para recarregar dados
      }
    } catch (error) {
      setUpdateError(error);
      console.error('[DEBUG] Erro ao atualizar atributo do contato:', error);
    } finally {
      setUpdating(false);
    }
  };

  return { updateContactAttribute, updating, updateError };
}

// Hook combinado para facilitar o consumo no componente
export function useKanbanData() {
  // Estado para forçar recarregamento dos dados do Kanban
  const [reloadFlag, setReloadFlag] = useState(0);

  // Passa reloadFlag como dependência para o hook de dados
  const { contacts, columns, attribute, listAttributes, displayNames, loading, error } = useDynamicKanbanData(reloadFlag);
  // Função para forçar reload
  const reloadKanban = () => setReloadFlag(f => f + 1);
  // Passa reloadKanban como callback de sucesso para o update e passa attribute para validação
  const { updateContactAttribute, updating, updateError } = useUpdateContactAttribute(reloadKanban, attribute, contacts);

  return {
    contacts,
    columns,
    attribute,
    listAttributes,
    displayNames,
    loading,
    error,
    updateContactAttribute,
    updating,
    updateError,
    reloadKanban // expõe função para reload manual se necessário
  };
}
