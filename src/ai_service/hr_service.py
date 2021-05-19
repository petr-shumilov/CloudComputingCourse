import deps.CraftML.src.craft_ml as cml
from deps.CraftML.src.craft_ml.data.dataset import Dataset, TableDataset

import traceback
import json
import numpy as np
import pandas as pd
import pickle
import sys
from flask import Flask, request, jsonify
import typing as t
import os

MODEL_FILEPATH = "./data/model.sav"
TRAIN_FILEPATH = "./data/Titanic/train.csv"
TEST_FILEPATH = "./data/Titanic/test.csv"
TARGET_COLUMN = "Survived"

TRAIN_SIZE = 0.9


def hr_classifier_pipeline() -> t.List[t.Dict[str, t.Any]]:
    classifier_model = cml.BlockParams(name='classifier',
                                   inputs=[],
                                   realization_class='Wrapper',
                                   realization_params=dict(
                                       class_name='xgboost.XGBClassifier',
                                       arguments=dict(
                                           random_state=100,
                                           n_jobs=-1
                                       ),
                                       method_to_run='id'
                                   ))
    split_block = cml.BlockParams(name='split_block',
                              inputs=['train_size'],
                              realization_class='Initializer',
                              realization_params=dict(
                                  class_name='craft_ml.data.split.TrainTestSplit',
                                  arguments={'random_state': 100, 'shuffle': True}
                              ))
    splitter = cml.BlockParams(name='splitter',
                           inputs=['split_block', 'process_train'],
                           realization_class='Apply',
                           realization_params={'method_to_run': 'get_splits'})
    train_val_data = cml.BlockParams(name='train_val_data',
                                 inputs=['splitter'],
                                 realization_class='NextSplit',
                                 realization_params={})
    split_train_data = cml.BlockParams(name='split_train_data',
                                   inputs=['train_val_data'],
                                   realization_class='GetIdx',
                                   realization_params={'index': 0})
    split_val_data = cml.BlockParams(name='split_val_data',
                                 inputs=['train_val_data'],
                                 realization_class='GetIdx',
                                 realization_params={'index': 1})
    training_block = cml.BlockParams(name='training_block',
                                 inputs=['classifier', 'split_train_data'],
                                 realization_class='TrainModel',
                                 realization_params=dict(
                                     use_wrapper='craft_ml.processing.model.SklearnClassifier'
                                 ))
    return list(map(cml.BlockParams.to_dict, [
        classifier_model, split_block,
        splitter, train_val_data, split_train_data, split_val_data,
        training_block
    ]))


def hr_learn_pipeline() -> t.List[t.Dict[str, t.Any]]:
    return cml.loading_pipeline() + cml.preprocessing_pipeline() + hr_classifier_pipeline()


def get_pipeline() -> cml.Pipeline:
    blocks_str = json.dumps(hr_learn_pipeline())
    pipeline = cml.Pipeline(blocks_str)
    return pipeline

def train():
    pipeline = get_pipeline()    
    pipe = pipeline.run_pipeline(dict(
        train_path=TRAIN_FILEPATH,
        test_path=TEST_FILEPATH,
        target_column=TARGET_COLUMN,
        train_size=TRAIN_SIZE
    ))
    pickle.dump(pipe, open(MODEL_FILEPATH, 'wb'))

def predictBy(age):
    pipe = pickle.load(open(MODEL_FILEPATH, 'rb'))
    
    test = pd.DataFrame([[float(age), 71.2833, 0.0000, 0.0000, 1.0, 1.0]], columns=['Age','Fare', 'Parch', 'PassengerId', 'Pclass', 'SibSp'])

    return pipe.predict_proba(TableDataset(test))[0].tolist()         

    
# create the Flask app
app = Flask(__name__)

@app.route('/predict')
def get_predict():
    try:
        age = request.args.get('age')

        res = predictBy(age)
        response = {
            "status": "ok",
            "payload": {
                "yes": res[1],
                "no": res[0]
            }
        }
        return jsonify(response)
    except:
        response = {
            "status": "error",
            "payload": sys.exc_info()[0]
        }
        return jsonify(response)

@app.route('/train')
def get_train():
    try:
        train()
        response = {
            "status": "ok",
            "payload": ""
        }
        return jsonify(response)
    except:
        response = {
            "status": "error",
            "payload": sys.exc_info()[0]
        }
        return jsonify(response)



if __name__ == '__main__':
    #train()
    #predictBy(30)
    port = int(os.environ.get('PORT', 5000))

    app.run(host='0.0.0.0', debug=True, port=port)
    
    



    