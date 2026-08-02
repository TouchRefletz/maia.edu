"""
Alias script: executar a seleção estratificada de 125 questões.
Redireciona para o script principal selecionar-questoes.py.
"""
import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
main_script = os.path.join(script_dir, "selecionar-questoes.py")

with open(main_script, "r", encoding="utf-8") as f:
    code = f.read()

exec(compile(code, main_script, "exec"))
