from app import app

if __name__ == "__main__":
    from waitress import serve

    from config import Config

    serve(app, host="0.0.0.0", port=Config.PORT, threads=8)