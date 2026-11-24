CREATE TABLE `areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `areas_nombre_unique` ON `areas` (`nombre`);--> statement-breakpoint
CREATE TABLE `docentes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`usuario` text NOT NULL,
	`pin_hash` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `docentes_usuario_unique` ON `docentes` (`usuario`);--> statement-breakpoint
CREATE TABLE `estudiantes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grupo_id` integer NOT NULL,
	`nombre` text NOT NULL,
	`usuario` text NOT NULL,
	`pin_hash` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `estudiantes_usuario_unique` ON `estudiantes` (`usuario`);--> statement-breakpoint
CREATE INDEX `idx_estudiantes_grupo` ON `estudiantes` (`grupo_id`);--> statement-breakpoint
CREATE TABLE `generadores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subtema_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`config` text NOT NULL,
	`peso` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`subtema_id`) REFERENCES `subtemas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_generadores` ON `generadores` (`subtema_id`,`tipo`,`config`);--> statement-breakpoint
CREATE TABLE `grados` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grados_nombre_unique` ON `grados` (`nombre`);--> statement-breakpoint
CREATE TABLE `grupos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grado_id` integer NOT NULL,
	`nombre` text NOT NULL,
	FOREIGN KEY (`grado_id`) REFERENCES `grados`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_grupos` ON `grupos` (`grado_id`,`nombre`);--> statement-breakpoint
CREATE TABLE `guias_taller` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subtema_id` integer NOT NULL,
	`titulo` text NOT NULL,
	`enunciado_html` text NOT NULL,
	`solucion_html` text,
	`orden` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`subtema_id`) REFERENCES `subtemas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_guias` ON `guias_taller` (`subtema_id`,`titulo`);--> statement-breakpoint
CREATE TABLE `intentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`estudiante_id` integer NOT NULL,
	`subtema_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`preguntas` text NOT NULL,
	`respuestas` text,
	`estado` text DEFAULT 'abierto' NOT NULL,
	`correctas` integer,
	`total` integer NOT NULL,
	`nota` real,
	`iniciado_en` text DEFAULT (datetime('now')) NOT NULL,
	`entregado_en` text,
	FOREIGN KEY (`estudiante_id`) REFERENCES `estudiantes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subtema_id`) REFERENCES `subtemas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_intentos_estudiante` ON `intentos` (`estudiante_id`,`subtema_id`,`tipo`);--> statement-breakpoint
CREATE TABLE `lecciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subtema_id` integer NOT NULL,
	`titulo` text NOT NULL,
	`html` text NOT NULL,
	`orden` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`subtema_id`) REFERENCES `subtemas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_lecciones` ON `lecciones` (`subtema_id`,`titulo`);--> statement-breakpoint
CREATE TABLE `periodos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `periodos_nombre_unique` ON `periodos` (`nombre`);--> statement-breakpoint
CREATE TABLE `preguntas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subtema_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`enunciado` text NOT NULL,
	`opciones` text,
	`respuesta` text NOT NULL,
	`explicacion` text,
	FOREIGN KEY (`subtema_id`) REFERENCES `subtemas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_preguntas` ON `preguntas` (`subtema_id`,`tipo`,`enunciado`);--> statement-breakpoint
CREATE TABLE `recursos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subtema_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`titulo` text NOT NULL,
	`descripcion` text,
	`url` text,
	`datos` text,
	`orden` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`subtema_id`) REFERENCES `subtemas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_recursos` ON `recursos` (`subtema_id`,`titulo`);--> statement-breakpoint
CREATE TABLE `subtemas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tema_id` integer NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer DEFAULT 1 NOT NULL,
	`habilitado` integer DEFAULT false NOT NULL,
	`disponible_desde` text,
	FOREIGN KEY (`tema_id`) REFERENCES `temas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_subtemas_tema` ON `subtemas` (`tema_id`);--> statement-breakpoint
CREATE TABLE `temas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`grado_id` integer NOT NULL,
	`periodo_id` integer NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grado_id`) REFERENCES `grados`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`periodo_id`) REFERENCES `periodos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_temas_ubicacion` ON `temas` (`area_id`,`grado_id`,`periodo_id`);