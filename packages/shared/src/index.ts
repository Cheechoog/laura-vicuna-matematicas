// =====================================================================
// @lv/shared — contratos de la API
// Backend y frontend importan estos tipos: si cambia uno, TypeScript
// avisa en los dos lados.
// =====================================================================

export type Rol = "estudiante" | "docente";

export type TipoPregunta = "mcq" | "vf" | "abierta";
export type TipoEvaluacion = "quiz" | "taller";
export type TipoRecurso = "video" | "juego" | "enlace" | "documento";

// ---------- Sesión ----------
export interface Sesion {
  rol: Rol;
  id: number;
  nombre: string;
  grado?: { id: number; nombre: string };
  grupo?: { id: number; nombre: string };
}

export interface GrupoOpcion {
  id: number;
  nombre: string;
  grado: string;
}

export interface EstudianteOpcion {
  id: number;
  nombre: string;
}

// ---------- Material de apoyo que acompaña una pregunta ----------
export type Apoyo =
  | { tipo: "lista"; titulo?: string; items: string[] }
  | { tipo: "tabla"; titulo?: string; columnas: string[]; filas: (string | number)[][] }
  | { tipo: "barras"; titulo?: string; etiquetaX: string; etiquetaY: string; barras: { etiqueta: string; valor: number }[] };

/** Pregunta tal como la ve el estudiante: nunca trae la respuesta. */
export interface PreguntaPublica {
  indice: number;
  tipo: TipoPregunta;
  enunciado: string;
  opciones?: string[];
  apoyo?: Apoyo;
}

// ---------- Catálogo ----------
export interface CapacidadesSubtema {
  leccion: boolean;
  practica: boolean;
  taller: boolean;
  quiz: boolean;
  recursos: boolean;
  guias: boolean;
}

/** ¿El subtema tiene algo que el estudiante pueda abrir? */
export function tieneContenido(c: CapacidadesSubtema): boolean {
  return c.leccion || c.practica || c.taller || c.quiz || c.recursos || c.guias;
}

export interface NotaEstado {
  entregado: boolean;
  nota: number | null;
  correctas?: number;
  total?: number;
  entregadoEn?: string | null;
}

export interface SubtemaResumen {
  id: number;
  nombre: string;
  orden: number;
  disponible: boolean;
  capacidades: CapacidadesSubtema;
  progreso?: { quiz: number | null; taller: number | null };
}

export interface TemaResumen {
  id: number;
  nombre: string;
  orden: number;
  subtemas: SubtemaResumen[];
}

export interface PeriodoResumen {
  id: number;
  nombre: string;
  orden: number;
  temas: TemaResumen[];
}

export interface PanelEstudiante {
  area: { id: number; nombre: string };
  grado: { id: number; nombre: string };
  periodos: PeriodoResumen[];
}

export interface Leccion {
  id: number;
  titulo: string;
  html: string;
}

export interface GuiaTaller {
  id: number;
  titulo: string;
  enunciadoHtml: string;
  /** Solo llega cuando quien consulta es docente. */
  solucionHtml?: string | null;
}

export interface Recurso {
  id: number;
  tipo: TipoRecurso;
  titulo: string;
  descripcion: string | null;
  url: string | null;
  datos: unknown;
}

export interface SubtemaDetalle {
  id: number;
  nombre: string;
  tema: { id: number; nombre: string };
  periodo: { id: number; nombre: string };
  grado: { id: number; nombre: string };
  disponible: boolean;
  capacidades: CapacidadesSubtema;
  lecciones: Leccion[];
  guias: GuiaTaller[];
  recursos: Recurso[];
  estado: { quiz: NotaEstado; taller: NotaEstado };
}

// ---------- Práctica ----------
export interface PracticaPregunta {
  pregunta: PreguntaPublica;
  token: string;
}

export interface PracticaVerificacion {
  correcta: boolean;
  respuestaCorrecta: string;
  explicacion?: string | null;
}

// ---------- Evaluaciones ----------
export interface IntentoAbierto {
  intentoId: number;
  tipo: TipoEvaluacion;
  preguntas: PreguntaPublica[];
}

export interface ResultadoPregunta {
  indice: number;
  correcta: boolean;
  respuestaDada: string;
  respuestaCorrecta: string;
  explicacion?: string | null;
}

export interface ResultadoEvaluacion {
  nota: number;
  correctas: number;
  total: number;
  porcentaje: number;
  detalle: ResultadoPregunta[];
}

// ---------- Docente ----------
export interface SubtemaDocente extends SubtemaResumen {
  habilitado: boolean;
  disponibleDesde: string | null;
  conteos: { lecciones: number; guias: number; preguntas: number; generadores: number; recursos: number };
}

export interface ArbolDocente {
  grados: { id: number; nombre: string }[];
  grado: { id: number; nombre: string };
  periodos: (Omit<PeriodoResumen, "temas"> & {
    temas: (Omit<TemaResumen, "subtemas"> & { subtemas: SubtemaDocente[] })[];
  })[];
}

export interface NotaCelda {
  quiz: number | null;
  taller: number | null;
  promedio: number | null;
}

export interface ReporteNotas {
  columnas: { subtemaId: number; subtema: string; tema: string }[];
  filas: {
    estudianteId: number;
    estudiante: string;
    grupo: string;
    notas: Record<number, NotaCelda>;
    promedio: number | null;
  }[];
}

export interface EstudianteDocente {
  id: number;
  nombre: string;
  usuario: string;
  activo: boolean;
}

// ---------- Errores ----------
export interface ErrorApi {
  error: string;
  codigo?: string;
  datos?: unknown;
}
