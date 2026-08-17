CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  pin text,
  tangerino_id text,
  cargo text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees visible to authenticated" ON public.employees
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/RH insert employees" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_rh(auth.uid()));
CREATE POLICY "Admin/RH update employees" ON public.employees
  FOR UPDATE TO authenticated USING (public.is_admin_or_rh(auth.uid()));
CREATE POLICY "Admin/RH delete employees" ON public.employees
  FOR DELETE TO authenticated USING (public.is_admin_or_rh(auth.uid()));

CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX employees_name_unique ON public.employees (lower(name));

INSERT INTO public.employees (name) VALUES
('Alef Assunção Romão'),
('Alessandro de Farias Bueno'),
('Alessandro Dos Santos'),
('Ángel Emmanuel Luna'),
('Arthur Nilson Cunha De Araújo'),
('Carlos Alexandre Rodrigues Ferreira'),
('Carlos Celio Xavier Junior'),
('Claudinei Jose Limas'),
('Daniel Josue Quilimaco Peraza'),
('Diego Farias'),
('Diego Pereira Tavares'),
('Diogo Godoy Nogueira'),
('Diogo Lima Herculano'),
('Eduardo Lopes Neves'),
('Ender Modesto Nunes'),
('Evandro Luiz Grasel'),
('Gabriel Bolda'),
('Gilcemar Dos Santos Neves'),
('Giovani De Almeida Da Rocha'),
('Guilherme dos Santos'),
('Guilherme Wozniak Gonçalves de Lima'),
('Harol José Afonzo Velasquez'),
('Heriberto Benítez Gómez'),
('Hugo Felipe Rosa da Silva'),
('Ismair Redriano Junho'),
('Jairo Braulio Estrada Estrada'),
('Jeferson Mauricio Ilha Duarte'),
('Jimmy Eduardo Ramirez Lopes'),
('Joao Vitor Golçalves Tertuliano'),
('Jonas Conceição de Sousa'),
('Jonata Luis Fernandes Silveira'),
('Jorge Luis Pinheiro da Trindade'),
('Jose Carlos Correa Junior'),
('José Gregorio Dominguez Baez'),
('Joseildo Vieira da Silva'),
('José Roberto da Silva Froes'),
('Jymkel Alejandro Ramilez Lopez'),
('Kaio Eduardo Muniz Da Gama'),
('Leonardo Henrique da Silva Kaschimichaki'),
('Leonel Jesus'),
('Levi Gabriel Caetano Muniz'),
('Lucas Couto da Silva'),
('Maicon Santos Da Silva'),
('Matheus Pinto da Silva'),
('Miguel Pereira Fogaça'),
('Ramiro Hernan Caballero'),
('Ricardo Barbosa Da Silva'),
('Rodrigo Camargo'),
('Rodrigo Garcia Lima'),
('Valdenor Borges Martins'),
('Victor Douglas Campos Carrera'),
('Victor Kanso De Oliveira'),
('Vinicius Baierle Seibt'),
('Vinicius Rafael Marques de Araujo'),
('Wanderson Santos de Aguiar'),
('Willian Campos Franco');