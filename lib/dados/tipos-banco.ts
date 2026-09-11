export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agente_execucoes: {
        Row: {
          agente: string
          cenario_id: string | null
          criado_em: string
          custo: number | null
          duracao_ms: number | null
          entrada: Json | null
          id: string
          modelo: string | null
          saida: Json | null
          status: string
          tokens_entrada: number | null
          tokens_saida: number | null
          versao_prompt: string | null
        }
        Insert: {
          agente: string
          cenario_id?: string | null
          criado_em?: string
          custo?: number | null
          duracao_ms?: number | null
          entrada?: Json | null
          id?: string
          modelo?: string | null
          saida?: Json | null
          status?: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
          versao_prompt?: string | null
        }
        Update: {
          agente?: string
          cenario_id?: string | null
          criado_em?: string
          custo?: number | null
          duracao_ms?: number | null
          entrada?: Json | null
          id?: string
          modelo?: string | null
          saida?: Json | null
          status?: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
          versao_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_execucoes_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      alocacoes: {
        Row: {
          cargo_id: string
          criado_em: string
          fim: string | null
          id: string
          inicio: string
          origem: Database["public"]["Enums"]["origem_alocacao"]
          pessoa_id: string
          projeto_id: string
        }
        Insert: {
          cargo_id: string
          criado_em?: string
          fim?: string | null
          id?: string
          inicio?: string
          origem?: Database["public"]["Enums"]["origem_alocacao"]
          pessoa_id: string
          projeto_id: string
        }
        Update: {
          cargo_id?: string
          criado_em?: string
          fim?: string | null
          id?: string
          inicio?: string
          origem?: Database["public"]["Enums"]["origem_alocacao"]
          pessoa_id?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alocacoes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          antes: Json | null
          autor: string | null
          depois: Json | null
          em: string
          id: number
          registro_id: string | null
          tabela: string
        }
        Insert: {
          acao: string
          antes?: Json | null
          autor?: string | null
          depois?: Json | null
          em?: string
          id?: number
          registro_id?: string | null
          tabela: string
        }
        Update: {
          acao?: string
          antes?: Json | null
          autor?: string | null
          depois?: Json | null
          em?: string
          id?: number
          registro_id?: string | null
          tabela?: string
        }
        Relationships: []
      }
      cargos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      cenarios: {
        Row: {
          atualizado_em: string
          base_cenario_id: string | null
          criado_em: string
          criado_por: string | null
          duracao_ms: number | null
          horizonte_inicio: string
          horizonte_semanas: number
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["perfil_otimizacao"]
          publicado_em: string | null
          rebalancear: boolean
          snapshot_premissas: Json | null
          solver: string
          status: Database["public"]["Enums"]["status_cenario"]
        }
        Insert: {
          atualizado_em?: string
          base_cenario_id?: string | null
          criado_em?: string
          criado_por?: string | null
          duracao_ms?: number | null
          horizonte_inicio?: string
          horizonte_semanas?: number
          id?: string
          nome: string
          perfil?: Database["public"]["Enums"]["perfil_otimizacao"]
          publicado_em?: string | null
          rebalancear?: boolean
          snapshot_premissas?: Json | null
          solver?: string
          status?: Database["public"]["Enums"]["status_cenario"]
        }
        Update: {
          atualizado_em?: string
          base_cenario_id?: string | null
          criado_em?: string
          criado_por?: string | null
          duracao_ms?: number | null
          horizonte_inicio?: string
          horizonte_semanas?: number
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["perfil_otimizacao"]
          publicado_em?: string | null
          rebalancear?: boolean
          snapshot_premissas?: Json | null
          solver?: string
          status?: Database["public"]["Enums"]["status_cenario"]
        }
        Relationships: [
          {
            foreignKeyName: "cenarios_base_cenario_id_fkey"
            columns: ["base_cenario_id"]
            isOneToOne: false
            referencedRelation: "cenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          prioridade: Database["public"]["Enums"]["prioridade_cliente"]
          sla_dias: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          prioridade?: Database["public"]["Enums"]["prioridade_cliente"]
          sla_dias?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          prioridade?: Database["public"]["Enums"]["prioridade_cliente"]
          sla_dias?: number | null
        }
        Relationships: []
      }
      concessoes: {
        Row: {
          cargo_id: string
          cenario_id: string
          criado_em: string
          id: string
          ocorrencia_id: string | null
          pessoa_id: string
          premissa: string
          unidade: string
          valor_alvo: number
          valor_aplicado: number
        }
        Insert: {
          cargo_id: string
          cenario_id: string
          criado_em?: string
          id?: string
          ocorrencia_id?: string | null
          pessoa_id: string
          premissa: string
          unidade?: string
          valor_alvo: number
          valor_aplicado: number
        }
        Update: {
          cargo_id?: string
          cenario_id?: string
          criado_em?: string
          id?: string
          ocorrencia_id?: string | null
          pessoa_id?: string
          premissa?: string
          unidade?: string
          valor_alvo?: number
          valor_aplicado?: number
        }
        Relationships: [
          {
            foreignKeyName: "concessoes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concessoes_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concessoes_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concessoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_nao_atendida: {
        Row: {
          cenario_id: string
          criado_em: string
          id: string
          motivo: string
          obrigatoria: boolean
          playbook_item_id: string
          projeto_id: string
          semana: number
          sla: boolean
        }
        Insert: {
          cenario_id: string
          criado_em?: string
          id?: string
          motivo: string
          obrigatoria?: boolean
          playbook_item_id: string
          projeto_id: string
          semana: number
          sla?: boolean
        }
        Update: {
          cenario_id?: string
          criado_em?: string
          id?: string
          motivo?: string
          obrigatoria?: boolean
          playbook_item_id?: string
          projeto_id?: string
          semana?: number
          sla?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "demanda_nao_atendida_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_nao_atendida_playbook_item_id_fkey"
            columns: ["playbook_item_id"]
            isOneToOne: false
            referencedRelation: "playbook_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_nao_atendida_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          chave: string
          criado_em: string
          hue: number
          id: string
          ordem: number
          prazo_dias: number
          rotulo: string
          urgencia: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          chave: string
          criado_em?: string
          hue?: number
          id?: string
          ordem?: number
          prazo_dias: number
          rotulo: string
          urgencia: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          chave?: string
          criado_em?: string
          hue?: number
          id?: string
          ordem?: number
          prazo_dias?: number
          rotulo?: string
          urgencia?: number
        }
        Relationships: []
      }
      eventos_externos: {
        Row: {
          criado_em: string
          external_id: string
          fim: string
          id: string
          inicio: string
          opaco: boolean
          pessoa_id: string
          provedor: Database["public"]["Enums"]["provedor_calendario"]
          titulo_hash: string | null
        }
        Insert: {
          criado_em?: string
          external_id: string
          fim: string
          id?: string
          inicio: string
          opaco?: boolean
          pessoa_id: string
          provedor: Database["public"]["Enums"]["provedor_calendario"]
          titulo_hash?: string | null
        }
        Update: {
          criado_em?: string
          external_id?: string
          fim?: string
          id?: string
          inicio?: string
          opaco?: boolean
          pessoa_id?: string
          provedor?: Database["public"]["Enums"]["provedor_calendario"]
          titulo_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_externos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_calendario: {
        Row: {
          atualizado_em: string
          criado_em: string
          escopos: string[]
          id: string
          pessoa_id: string
          provedor: Database["public"]["Enums"]["provedor_calendario"]
          segredo_id: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          escopos?: string[]
          id?: string
          pessoa_id: string
          provedor: Database["public"]["Enums"]["provedor_calendario"]
          segredo_id?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          escopos?: string[]
          id?: string
          pessoa_id?: string
          provedor?: Database["public"]["Enums"]["provedor_calendario"]
          segredo_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_calendario_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis_snapshot: {
        Row: {
          blocos_foco: number
          cenario_id: string
          criado_em: string
          fragmentacao: number
          horas: number
          id: string
          pessoa_id: string
          produtivo: number
          reunioes: number
          semana: number
          taxa: number
        }
        Insert: {
          blocos_foco: number
          cenario_id: string
          criado_em?: string
          fragmentacao: number
          horas: number
          id?: string
          pessoa_id: string
          produtivo: number
          reunioes: number
          semana: number
          taxa: number
        }
        Update: {
          blocos_foco?: number
          cenario_id?: string
          criado_em?: string
          fragmentacao?: number
          horas?: number
          id?: string
          pessoa_id?: string
          produtivo?: number
          reunioes?: number
          semana?: number
          taxa?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpis_snapshot_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_snapshot_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          calendar_event_ids: Json
          camada: number
          cenario_id: string
          criado_em: string
          fim: string
          id: string
          inicio: string
          justificativa: string | null
          playbook_item_id: string
          projeto_id: string
          relaxada: boolean
          semana: number
          serie_id: string | null
          sla: boolean
          status: Database["public"]["Enums"]["status_ocorrencia"]
        }
        Insert: {
          calendar_event_ids?: Json
          camada?: number
          cenario_id: string
          criado_em?: string
          fim: string
          id?: string
          inicio: string
          justificativa?: string | null
          playbook_item_id: string
          projeto_id: string
          relaxada?: boolean
          semana: number
          serie_id?: string | null
          sla?: boolean
          status?: Database["public"]["Enums"]["status_ocorrencia"]
        }
        Update: {
          calendar_event_ids?: Json
          camada?: number
          cenario_id?: string
          criado_em?: string
          fim?: string
          id?: string
          inicio?: string
          justificativa?: string | null
          playbook_item_id?: string
          projeto_id?: string
          relaxada?: boolean
          semana?: number
          serie_id?: string | null
          sla?: boolean
          status?: Database["public"]["Enums"]["status_ocorrencia"]
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_playbook_item_id_fkey"
            columns: ["playbook_item_id"]
            isOneToOne: false
            referencedRelation: "playbook_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      participantes: {
        Row: {
          cargo_id: string
          confirmado: boolean
          obrigatorio: boolean
          ocorrencia_id: string
          pessoa_id: string
          substituiu_pessoa_id: string | null
        }
        Insert: {
          cargo_id: string
          confirmado?: boolean
          obrigatorio?: boolean
          ocorrencia_id: string
          pessoa_id: string
          substituiu_pessoa_id?: string | null
        }
        Update: {
          cargo_id?: string
          confirmado?: boolean
          obrigatorio?: boolean
          ocorrencia_id?: string
          pessoa_id?: string
          substituiu_pessoa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participantes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_substituiu_pessoa_id_fkey"
            columns: ["substituiu_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_usuario: {
        Row: {
          atualizado_em: string
          criado_em: string
          nome: string | null
          papel_app: Database["public"]["Enums"]["papel_app"]
          pessoa_id: string | null
          tema: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          nome?: string | null
          papel_app?: Database["public"]["Enums"]["papel_app"]
          pessoa_id?: string | null
          tema?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          nome?: string | null
          papel_app?: Database["public"]["Enums"]["papel_app"]
          pessoa_id?: string | null
          tema?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_usuario_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cargo_id: string
          criado_em: string
          email: string | null
          id: string
          iniciais: string
          nome: string
          senioridade: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cargo_id: string
          criado_em?: string
          email?: string | null
          id?: string
          iniciais: string
          nome: string
          senioridade?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cargo_id?: string
          criado_em?: string
          email?: string | null
          id?: string
          iniciais?: string
          nome?: string
          senioridade?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_item_cargos: {
        Row: {
          cargo_id: string
          playbook_item_id: string
        }
        Insert: {
          cargo_id: string
          playbook_item_id: string
        }
        Update: {
          cargo_id?: string
          playbook_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_item_cargos_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_item_cargos_playbook_item_id_fkey"
            columns: ["playbook_item_id"]
            isOneToOne: false
            referencedRelation: "playbook_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_itens: {
        Row: {
          atualizado_em: string
          cadencia_semanas: number
          criado_em: string
          duracao_min: number
          etapa_id: string
          id: string
          obrigatoria: boolean
          ordem: number
          prioridade: number
          tipo_cerimonia_id: string
        }
        Insert: {
          atualizado_em?: string
          cadencia_semanas: number
          criado_em?: string
          duracao_min: number
          etapa_id: string
          id?: string
          obrigatoria?: boolean
          ordem?: number
          prioridade: number
          tipo_cerimonia_id: string
        }
        Update: {
          atualizado_em?: string
          cadencia_semanas?: number
          criado_em?: string
          duracao_min?: number
          etapa_id?: string
          id?: string
          obrigatoria?: boolean
          ordem?: number
          prioridade?: number
          tipo_cerimonia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_itens_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_itens_tipo_cerimonia_id_fkey"
            columns: ["tipo_cerimonia_id"]
            isOneToOne: false
            referencedRelation: "tipos_cerimonia"
            referencedColumns: ["id"]
          },
        ]
      }
      premissas_cargo: {
        Row: {
          autor: string | null
          bloco_foco_min_min: number
          cargo_id: string
          criado_em: string
          custo_hora: number
          duracao_max_min: number
          fator_ausencia: number
          id: string
          janela_protegida_min: number
          jornada: number
          max_horas_dia: number
          max_horas_mes: number
          max_horas_semana: number
          max_reunioes_dia: number
          produtivo_min: number
          tempo_institucional: number
          tolerancia: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          autor?: string | null
          bloco_foco_min_min: number
          cargo_id: string
          criado_em?: string
          custo_hora?: number
          duracao_max_min: number
          fator_ausencia: number
          id?: string
          janela_protegida_min: number
          jornada: number
          max_horas_dia: number
          max_horas_mes: number
          max_horas_semana: number
          max_reunioes_dia: number
          produtivo_min: number
          tempo_institucional: number
          tolerancia: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          autor?: string | null
          bloco_foco_min_min?: number
          cargo_id?: string
          criado_em?: string
          custo_hora?: number
          duracao_max_min?: number
          fator_ausencia?: number
          id?: string
          janela_protegida_min?: number
          jornada?: number
          max_horas_dia?: number
          max_horas_mes?: number
          max_horas_semana?: number
          max_reunioes_dia?: number
          produtivo_min?: number
          tempo_institucional?: number
          tolerancia?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "premissas_cargo_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      premissas_gerais: {
        Row: {
          autor: string | null
          chave: string
          criado_em: string
          id: string
          valor: Json
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          autor?: string | null
          chave: string
          criado_em?: string
          id?: string
          valor: Json
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          autor?: string | null
          chave?: string
          criado_em?: string
          id?: string
          valor?: Json
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      premissas_override: {
        Row: {
          autor: string | null
          campo: string
          criado_em: string
          escopo: Database["public"]["Enums"]["escopo_override"]
          escopo_id: string
          id: string
          valor: Json
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          autor?: string | null
          campo: string
          criado_em?: string
          escopo: Database["public"]["Enums"]["escopo_override"]
          escopo_id: string
          id?: string
          valor: Json
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          autor?: string | null
          campo?: string
          criado_em?: string
          escopo?: Database["public"]["Enums"]["escopo_override"]
          escopo_id?: string
          id?: string
          valor?: Json
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      prioridades_cliente: {
        Row: {
          nivel: Database["public"]["Enums"]["prioridade_cliente"]
          peso: number
        }
        Insert: {
          nivel: Database["public"]["Enums"]["prioridade_cliente"]
          peso: number
        }
        Update: {
          nivel?: Database["public"]["Enums"]["prioridade_cliente"]
          peso?: number
        }
        Relationships: []
      }
      produtos: {
        Row: {
          complexidade: number
          criado_em: string
          id: string
          projeto_id: string
          status: string
          tipo: Database["public"]["Enums"]["tipo_produto"]
        }
        Insert: {
          complexidade?: number
          criado_em?: string
          id?: string
          projeto_id: string
          status?: string
          tipo: Database["public"]["Enums"]["tipo_produto"]
        }
        Update: {
          complexidade?: number
          criado_em?: string
          id?: string
          projeto_id?: string
          status?: string
          tipo?: Database["public"]["Enums"]["tipo_produto"]
        }
        Relationships: [
          {
            foreignKeyName: "produtos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          ativo: boolean
          atraso_dias: number
          atualizado_em: string
          cliente_id: string
          criado_em: string
          etapa_id: string
          golive_alvo: string | null
          health: Database["public"]["Enums"]["health_projeto"]
          id: string
          inicio: string | null
          mes: number
          nome: string
          prioridade: Database["public"]["Enums"]["prioridade_cliente"] | null
          time_id: string
        }
        Insert: {
          ativo?: boolean
          atraso_dias?: number
          atualizado_em?: string
          cliente_id: string
          criado_em?: string
          etapa_id: string
          golive_alvo?: string | null
          health?: Database["public"]["Enums"]["health_projeto"]
          id?: string
          inicio?: string | null
          mes?: number
          nome: string
          prioridade?: Database["public"]["Enums"]["prioridade_cliente"] | null
          time_id: string
        }
        Update: {
          ativo?: boolean
          atraso_dias?: number
          atualizado_em?: string
          cliente_id?: string
          criado_em?: string
          etapa_id?: string
          golive_alvo?: string | null
          health?: Database["public"]["Enums"]["health_projeto"]
          id?: string
          inicio?: string | null
          mes?: number
          nome?: string
          prioridade?: Database["public"]["Enums"]["prioridade_cliente"] | null
          time_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          ancorada: boolean
          cadencia_semanas: number
          criado_em: string
          dia_ancora: number | null
          fim: string | null
          id: string
          inicio: string
          playbook_item_id: string
          projeto_id: string
          slot_ancora: number | null
        }
        Insert: {
          ancorada?: boolean
          cadencia_semanas: number
          criado_em?: string
          dia_ancora?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          playbook_item_id: string
          projeto_id: string
          slot_ancora?: number | null
        }
        Update: {
          ancorada?: boolean
          cadencia_semanas?: number
          criado_em?: string
          dia_ancora?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          playbook_item_id?: string
          projeto_id?: string
          slot_ancora?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "series_playbook_item_id_fkey"
            columns: ["playbook_item_id"]
            isOneToOne: false
            referencedRelation: "playbook_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      solver_jobs: {
        Row: {
          atualizado_em: string
          cenario_id: string
          criado_em: string
          entrada: Json
          erro: string | null
          id: string
          saida: Json | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          cenario_id: string
          criado_em?: string
          entrada: Json
          erro?: string | null
          id?: string
          saida?: Json | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          cenario_id?: string
          criado_em?: string
          entrada?: Json
          erro?: string | null
          id?: string
          saida?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solver_jobs_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      time_membros: {
        Row: {
          pessoa_id: string
          time_id: string
        }
        Insert: {
          pessoa_id: string
          time_id: string
        }
        Update: {
          pessoa_id?: string
          time_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_membros_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_membros_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      times: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      tipos_cerimonia: {
        Row: {
          criado_em: string
          hue: number
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          hue?: number
          id?: string
          nome: string
        }
        Update: {
          criado_em?: string
          hue?: number
          id?: string
          nome?: string
        }
        Relationships: []
      }
      trocas_cadeira: {
        Row: {
          cargo_id: string
          cenario_id: string
          criado_em: string
          de_pessoa_id: string
          id: string
          ocorrencia_id: string | null
          para_pessoa_id: string
        }
        Insert: {
          cargo_id: string
          cenario_id: string
          criado_em?: string
          de_pessoa_id: string
          id?: string
          ocorrencia_id?: string | null
          para_pessoa_id: string
        }
        Update: {
          cargo_id?: string
          cenario_id?: string
          criado_em?: string
          de_pessoa_id?: string
          id?: string
          ocorrencia_id?: string | null
          para_pessoa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trocas_cadeira_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_cadeira_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_cadeira_de_pessoa_id_fkey"
            columns: ["de_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_cadeira_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_cadeira_para_pessoa_id_fkey"
            columns: ["para_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      premissas_cargo_vigentes: {
        Row: {
          autor: string | null
          bloco_foco_min_min: number | null
          cargo: string | null
          cargo_id: string | null
          criado_em: string | null
          custo_hora: number | null
          duracao_max_min: number | null
          fator_ausencia: number | null
          id: string | null
          janela_protegida_min: number | null
          jornada: number | null
          max_horas_dia: number | null
          max_horas_mes: number | null
          max_horas_semana: number | null
          max_reunioes_dia: number | null
          produtivo_min: number | null
          tempo_institucional: number | null
          tolerancia: number | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premissas_cargo_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      premissas_gerais_vigentes: {
        Row: {
          chave: string | null
          valor: Json | null
        }
        Insert: {
          chave?: string | null
          valor?: Json | null
        }
        Update: {
          chave?: string | null
          valor?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      carregar_mundo: { Args: never; Returns: Json }
      definir_premissa_cargo: {
        Args: { p_cargo_id: string; p_valores: Json }
        Returns: string
      }
      excluir_time: {
        Args: { p_destino: string; p_time: string }
        Returns: undefined
      }
      remover_etapa: {
        Args: { p_destino: string; p_etapa: string }
        Returns: undefined
      }
      salvar_squads: { Args: { p_cadeiras: Json }; Returns: undefined }
      tem_papel: {
        Args: { minimo: Database["public"]["Enums"]["papel_app"] }
        Returns: boolean
      }
    }
    Enums: {
      escopo_override: "pessoa" | "projeto"
      health_projeto: "verde" | "amarelo" | "vermelho"
      origem_alocacao: "auto" | "manual"
      papel_app: "admin" | "gestor" | "leitor"
      perfil_otimizacao: "foco" | "equilibrio" | "cliente" | "estabilidade"
      prioridade_cliente: "alta" | "media" | "baixa"
      provedor_calendario: "google" | "microsoft"
      status_cenario: "rascunho" | "simulado" | "publicado" | "arquivado"
      status_ocorrencia:
        | "planejada"
        | "confirmada"
        | "realizada"
        | "cancelada"
        | "adiada"
      tipo_produto: "relatorio" | "dashboard" | "integracao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      escopo_override: ["pessoa", "projeto"],
      health_projeto: ["verde", "amarelo", "vermelho"],
      origem_alocacao: ["auto", "manual"],
      papel_app: ["admin", "gestor", "leitor"],
      perfil_otimizacao: ["foco", "equilibrio", "cliente", "estabilidade"],
      prioridade_cliente: ["alta", "media", "baixa"],
      provedor_calendario: ["google", "microsoft"],
      status_cenario: ["rascunho", "simulado", "publicado", "arquivado"],
      status_ocorrencia: [
        "planejada",
        "confirmada",
        "realizada",
        "cancelada",
        "adiada",
      ],
      tipo_produto: ["relatorio", "dashboard", "integracao"],
    },
  },
} as const
