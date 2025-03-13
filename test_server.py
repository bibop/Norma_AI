from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"message": "Test server is running"})

@app.route('/api/test')
def test():
    return jsonify({
        "status": "ok",
        "message": "Connection successful"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
