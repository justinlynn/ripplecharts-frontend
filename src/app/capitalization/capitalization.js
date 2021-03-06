angular.module( 'ripplecharts.capitalization', [
  'ui.state',
  'ui.bootstrap'
])

.config(function config( $stateProvider ) {
  $stateProvider.state( 'capitalization', {
    url: '/capitalization',
    views: {
      "main": {
        controller: 'CapitalizationCtrl',
        templateUrl: 'capitalization/capitalization.tpl.html'
      }
    },
    data:{ pageTitle: 'Network Capitalization' }
  });
})

.controller( 'CapitalizationCtrl', function CapitalizationCtrl( $scope ) {

//  CapitalizationChart();
  
  var cap = new CapChart ({
    id       : "#capitalizationChart",
    url      : API,  
    resize   : true
  });


//stop the listeners when leaving page  
  $scope.$on("$destroy", function(){
    cap.suspend();
  });    
});
