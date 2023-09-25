import requests
import zipfile
import csv
import os
import ast

def search_repositories(query, language, min_stars, num_repositories=100):
    ''' Send a search query to the GitHub API and return a list of repository names. '''
    base_url = "https://api.github.com/search/repositories"
    headers = {"Accept": "application/vnd.github.v3+json"}

    query_params = {
        "q": f"{query} language:{language} stars:{min_stars}..9999999",
        "sort": "stars",
        "order": "desc",
        "language": "python",
        "per_page": num_repositories
    }

    response = requests.get(base_url, params=query_params, headers=headers)

    if response.status_code == 200:
        data = response.json()
        return [item["full_name"] for item in data["items"]]
    else:
        print("Failed to fetch repositories.")
        return []

def extract_code(repo_name):
    ''' Send a request to github and download relevant repositories.'''
    url = f"https://github.com/{repo_name}/archive/master.zip"
    response = requests.get(url, stream=True)
    
    if response.status_code == 200:
        with open('temp_repo.zip', 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        with zipfile.ZipFile('temp_repo.zip', 'r') as zip_ref:
            try:
                zip_ref.extractall('temp_repo')
                print("Extraction completed successfully.")
            except FileNotFoundError as e:
                print(f"Error during extraction: {e}")
                pass


def parse_files_in_directory(directory_path):
    ''' Parse all Python files in a directory and return a list of code snippets. '''
    code_snippets = []
    for root, _, files in os.walk(directory_path):
        for file_name in files:
            if file_name[-3:] == '.py':
                print(file_name)
                file_path = os.path.join(root, file_name)
                snippets = extract_code_segments_from_file(file_path)
                code_snippets.extend(snippets)
    return code_snippets

def extract_code_segments_from_file(file_path):
    ''' Extract code segments (functions, classes, etc.) from a file. '''
    code_segments = []
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()

    try:
        tree = ast.parse(content)
    except SyntaxError:
        # Handle cases where the file doesn't contain valid Python code
        return []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            code = ast.unparse(node)
            code_segments.append((file_path, code))

    return code_segments

def get_second_directory(path):
    parts = path.split(os.sep)
    if len(parts) >= 2:
        return parts[1]
    else:
        return None


if __name__ == "__main__":
    query = "healthcare AI"  # The keyword or topic you want to search for
    language = "python"   # The programming language you are interested in
    min_stars = 100      # Minimum stars the repositories should have
    num_repositories=10 # Number of repositories to scrape

    repositories_to_scrape = search_repositories(query, language, min_stars, num_repositories)
    output_file = "code_snippets.csv"
    
    for repo_url in repositories_to_scrape:
        extract_code(repo_url)

    # Extract code snippets from each repository and save them to the CSV file
    with open(output_file, 'w', encoding='utf-8', newline='') as csv_file:
       csv_writer = csv.writer(csv_file)
       csv_writer.writerow(['Repo' ,'File', 'Code Snippet'])
       snippets = parse_files_in_directory('temp_repo')    
       for snippet in snippets:
             csv_writer.writerow([get_second_directory(snippet[0]), snippet[0], snippet[1]])
       
           
        
