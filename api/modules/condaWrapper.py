import sys
import subprocess

conda_env_name = sys.argv[1]
script_to_run = sys.argv[2]
script_args = sys.argv[3:]

try:
    # Activate the conda environment
    activate_command = f'conda activate {conda_env_name}'
    subprocess.run(activate_command, shell=True, check=True)

    # Run the desired Python script
    subprocess.run(['python', script_to_run] + script_args, check=True)

except subprocess.CalledProcessError as e:
    sys.exit(e.returncode)
